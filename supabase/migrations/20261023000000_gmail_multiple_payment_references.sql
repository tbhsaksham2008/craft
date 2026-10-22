alter table public.gmail_payment_transaction_references
  drop constraint if exists
    gmail_payment_transaction_references_gmail_event_id_key;

create index if not exists gmail_payment_transaction_references_event_idx
  on public.gmail_payment_transaction_references (gmail_event_id);
