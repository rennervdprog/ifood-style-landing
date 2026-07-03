# ItaSuper — ProGuard Rules
# Aplicado apenas no build release (minifyEnabled true)

# ── Capacitor ──────────────────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.CapacitorPlugin <methods>;
    @com.getcapacitor.PluginMethod <methods>;
}

# ── Firebase / FCM (Push Notifications) ──────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── WebView / JavaScript Interface ────────────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Capacitor Plugins usados ──────────────────────────────────────
# StatusBar
-keep class com.getcapacitor.plugin.statusbar.** { *; }
# SplashScreen
-keep class com.getcapacitor.plugin.splashscreen.** { *; }
# Geolocation
-keep class com.getcapacitor.plugin.geolocation.** { *; }
# PushNotifications
-keep class com.getcapacitor.plugin.push.** { *; }
# Haptics
-keep class com.getcapacitor.plugin.haptics.** { *; }
# Keyboard
-keep class com.getcapacitor.plugin.keyboard.** { *; }
# Network
-keep class com.getcapacitor.plugin.network.** { *; }
# Preferences (Storage)
-keep class com.getcapacitor.plugin.storage.** { *; }

# ── Background Geolocation ────────────────────────────────────────
-keep class com.capacitorjs.plugins.backgroundgeolocation.** { *; }

# ── Sentry (crash reporting nativo) ───────────────────────────────
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# ── Preservar info de stack trace para Sentry ────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Evitar warnings desnecessários ───────────────────────────────
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
