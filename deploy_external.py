import os
import subprocess

project_id = os.environ.get('EXTERNAL_PROJECT_ID')
token = os.environ.get('SUPABASE_ACCESS_TOKEN')

# List of functions to deploy
functions = [
    "admin-broadcast-push", "admin-payout-store", "asaas-webhook", 
    "auto-deactivate-stores", "auto-finalize-orders", "auto-payout-cron", 
    "create-mp-preference", "create-pix-payment", "create-withdrawal-request", 
    "delete-account", "generate-commission-charge", "mercadopago-webhook", 
    "monthly-billing", "mp-return", "og-store", "parse-menu-pdf", 
    "partner-payout-cron", "payment-router", "public-store-catalog", 
    "register-push-device", "send-push", "store-platform-fee-pix", 
    "subscribe-plan-payment", "sync-to-external", "weekly-platform-report", 
    "zapi-send-internal", "zapi-send-message", "zapi-webhook"
]

# Set secrets
secrets_to_set = [
    "ASAAS_API_KEY", "ASAAS_WEBHOOK_TOKEN", "EFI_CLIENT_ID", "EFI_CLIENT_SECRET",
    "EFI_PIX_KEY", "MERCADO_PAGO_ACCESS_TOKEN", "MERCADO_PAGO_PUBLIC_KEY",
    "ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY"
]

for secret in secrets_to_set:
    val = os.environ.get(secret)
    if val:
        print(f"Setting secret {secret}...")
        subprocess.run(["nix", "run", "nixpkgs#supabase-cli", "--", "secrets", "set", f"{secret}={val}", "--project-ref", project_id], env={**os.environ, "SUPABASE_ACCESS_TOKEN": token})

# Deploy functions
for func in functions:
    print(f"Deploying function {func}...")
    subprocess.run(["nix", "run", "nixpkgs#supabase-cli", "--", "functions", "deploy", func, "--project-ref", project_id], env={**os.environ, "SUPABASE_ACCESS_TOKEN": token})

