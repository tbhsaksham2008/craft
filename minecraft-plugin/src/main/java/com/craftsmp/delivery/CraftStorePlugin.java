package com.craftsmp.delivery;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSyntaxException;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;

public final class CraftStorePlugin extends JavaPlugin implements Listener {
  private HttpClient httpClient;
  private String apiUrl;
  private String token;
  private List<String> purchaseMessage;
  private Duration requestTimeout;
  private long joinDelayTicks;
  private long paymentScanCooldownNanos;
  private final AtomicBoolean scanRunning = new AtomicBoolean();
  private final AtomicLong lastScanNanos = new AtomicLong();

  @Override
  public void onEnable() {
    saveDefaultConfig();
    apiUrl = getConfig().getString("store.api-url", "").replaceAll("/+$", "");
    token = getConfig().getString("store.token", "").trim();
    purchaseMessage = getConfig().getStringList("announcements.purchase-message");
    int timeoutSeconds = getConfig().getInt("store.request-timeout-seconds", 10);
    joinDelayTicks = Math.max(0, getConfig().getLong("store.join-delay-ticks", 20));
    int paymentScanCooldownSeconds = getConfig().getInt(
        "store.payment-scan-cooldown-seconds",
        300);

    if (apiUrl.isBlank() || token.isBlank() || timeoutSeconds < 1
        || paymentScanCooldownSeconds < 60) {
      getLogger().severe(
          "Set store.api-url, store.token, a positive request timeout, and a payment scan cooldown of at least 60 seconds in config.yml.");
      getServer().getPluginManager().disablePlugin(this);
      return;
    }

    try {
      URI uri = URI.create(apiUrl);
      if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
        throw new IllegalArgumentException("HTTPS is required.");
      }
    } catch (IllegalArgumentException exception) {
      getLogger().log(Level.SEVERE, "store.api-url is not a valid URL.", exception);
      getServer().getPluginManager().disablePlugin(this);
      return;
    }

    requestTimeout = Duration.ofSeconds(timeoutSeconds);
    paymentScanCooldownNanos = Duration.ofSeconds(paymentScanCooldownSeconds).toNanos();
    httpClient = HttpClient.newBuilder()
        .connectTimeout(requestTimeout)
        .build();
    getServer().getPluginManager().registerEvents(this, this);
    getLogger().info(
        "Store delivery is enabled; rewards are checked when players join and payment notifications are scanned on join (cooldown: "
            + paymentScanCooldownSeconds + " seconds).");
  }

  @EventHandler
  public void onPlayerJoin(PlayerJoinEvent event) {
    Player player = event.getPlayer();
    Bukkit.getScheduler().runTaskLater(
        this,
        () -> {
          String username = player.getName();
          Bukkit.getScheduler().runTaskAsynchronously(
              this,
              () -> claimForPlayer(username));
          Bukkit.getScheduler().runTaskAsynchronously(
              this,
              this::scanPayments);
        },
        joinDelayTicks);
  }

  private void claimForPlayer(String username) {
    try {
      JsonObject requestBody = new JsonObject();
      requestBody.addProperty("username", username);
      HttpResponse<String> response = post("/api/game/claim", requestBody);
      if (response.statusCode() != 200) {
        getLogger().warning("Could not claim rewards for " + username + ": HTTP " + response.statusCode());
        return;
      }

      JsonObject payload = JsonParser.parseString(response.body()).getAsJsonObject();
      JsonArray deliveries = payload.getAsJsonArray("deliveries");
      for (int index = 0; index < deliveries.size(); index++) {
        JsonObject delivery = deliveries.get(index).getAsJsonObject();
        dispatchDelivery(delivery, username);
      }
    } catch (IOException | InterruptedException | JsonSyntaxException | IllegalStateException exception) {
      if (exception instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      getLogger().log(Level.WARNING, "Could not load queued rewards for " + username, exception);
    }
  }

  private void scanPayments() {
    long now = System.nanoTime();
    long lastScan = lastScanNanos.get();
    if (lastScan != 0 && now - lastScan < paymentScanCooldownNanos) {
      return;
    }
    if (!scanRunning.compareAndSet(false, true)) {
      return;
    }
    lastScanNanos.set(now);
    try {
      HttpResponse<String> response = post("/api/game/scan", new JsonObject());
      if (response.statusCode() != 200) {
        getLogger().warning("Scheduled Gmail scan failed: HTTP " + response.statusCode());
        return;
      }
      JsonObject result = JsonParser.parseString(response.body()).getAsJsonObject();
      int approved = result.has("autoApproved")
          ? result.get("autoApproved").getAsInt()
          : 0;
      if (approved > 0) {
        getLogger().info("Automatically accepted " + approved + " matching payment notification(s).");
      }
    } catch (IOException | InterruptedException | JsonSyntaxException | IllegalStateException exception) {
      if (exception instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      getLogger().log(Level.WARNING, "Scheduled Gmail scan could not complete.", exception);
    } finally {
      scanRunning.set(false);
    }
  }

  private void dispatchDelivery(JsonObject delivery, String username) {
    String queueId = requiredString(delivery, "queueId");
    String productName = requiredString(delivery, "productName");
    int quantity = delivery.get("quantity").getAsInt();
    JsonArray commandArray = delivery.getAsJsonArray("commands");
    List<String> commands = new ArrayList<>();
    for (int index = 0; index < commandArray.size(); index++) {
      commands.add(commandArray.get(index).getAsString());
    }

    Bukkit.getScheduler().runTask(this, () -> {
      boolean success = true;
      String failureReason = null;
      ConsoleCommandSender console = Bukkit.getConsoleSender();
      for (String command : commands) {
        try {
          if (!Bukkit.dispatchCommand(console, command)) {
            success = false;
            failureReason = "Command was not handled: " + command;
            break;
          }
        } catch (RuntimeException exception) {
          success = false;
          failureReason = "Command failed: " + exception.getMessage();
          getLogger().log(Level.WARNING, "Reward command failed for " + productName, exception);
          break;
        }
      }
      if (success) {
        broadcastPurchase(username, productName, quantity);
      }
      acknowledgeDelivery(queueId, success, failureReason);
    });
  }

  private void broadcastPurchase(String username, String productName, int quantity) {
    for (String line : purchaseMessage) {
      String message = line
          .replace("{player}", username)
          .replace("{item}", productName)
          .replace("{quantity}", Integer.toString(quantity));
      Bukkit.broadcastMessage(ChatColor.translateAlternateColorCodes('&', message));
    }
  }

  private void acknowledgeDelivery(String queueId, boolean success, String error) {
    Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
      JsonObject requestBody = new JsonObject();
      requestBody.addProperty("queueId", queueId);
      requestBody.addProperty("success", success);
      if (error != null) {
        requestBody.addProperty("error", error);
      }

      try {
        HttpResponse<String> response = post("/api/game/complete", requestBody);
        if (response.statusCode() != 200) {
          getLogger().warning("Could not acknowledge reward " + queueId + ": HTTP " + response.statusCode());
        } else if (success) {
          getLogger().info("Delivered store reward " + queueId + ".");
        } else {
          getLogger().warning("Reward " + queueId + " failed and was recorded for admin review.");
        }
      } catch (IOException | InterruptedException exception) {
        if (exception instanceof InterruptedException) {
          Thread.currentThread().interrupt();
        }
        getLogger().log(Level.WARNING, "Could not acknowledge reward " + queueId, exception);
      }
    });
  }

  private HttpResponse<String> post(String path, JsonObject body)
      throws IOException, InterruptedException {
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(apiUrl + path))
        .timeout(requestTimeout)
        .header("Authorization", "Bearer " + token)
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
        .build();
    return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static String requiredString(JsonObject object, String key) {
    JsonPrimitive value = object.getAsJsonPrimitive(key);
    if (value == null || !value.isString() || value.getAsString().isBlank()) {
      throw new IllegalStateException("Delivery payload is missing " + key + ".");
    }
    return value.getAsString();
  }
}
