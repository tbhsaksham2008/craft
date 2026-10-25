plugins {
    java
}

group = "com.craftsmp"
version = "1.0.0"

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(25))
}

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    compileOnly("io.papermc.paper:paper-api:26.3.build.+")
    implementation("com.google.code.gson:gson:2.13.1")
}

tasks {
    processResources {
        filesMatching("plugin.yml") {
            expand("version" to project.version)
        }
    }

    jar {
        archiveBaseName.set("craft-store-status-delivery")
    }

    register<Jar>("deliveryOnlyJar") {
        dependsOn(named("classes"))
        archiveBaseName.set("craft-store-delivery")
        from(sourceSets.main.get().output) {
            exclude("plugin.yml", "config.yml")
        }
        from("src/delivery-only/resources") {
            expand("version" to project.version)
        }
    }
}
