import groovy.json.JsonSlurper

plugins {
    id("com.android.application")
}

// The version comes from the repo's package.json so Windows and Android always match.
@Suppress("UNCHECKED_CAST")
val pkg = JsonSlurper().parse(rootDir.resolve("../package.json")) as Map<String, Any>
val appVersion = pkg["version"] as String
val (major, minor, patch) = appVersion.split(".").map { it.toInt() }

// Release signing: set ANDROID_KEYSTORE_FILE / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS to sign
// with your permanent key (required for installing new versions as updates). Otherwise the debug key is used.
val keystoreFile = System.getenv("ANDROID_KEYSTORE_FILE")?.takeIf { it.isNotBlank() }?.let { file(it) }

android {
    namespace = "com.nasimrahayi.clinic"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nasimrahayi.clinic"
        minSdk = 24
        targetSdk = 35
        versionCode = major * 10000 + minor * 100 + patch
        versionName = appVersion
    }

    signingConfigs {
        if (keystoreFile != null) {
            create("release") {
                storeFile = keystoreFile
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    // The app itself is the web build in ../dist (shared with the Windows build), produced by buildWeb below.
    sourceSets["main"].assets.srcDirs(rootDir.resolve("../dist"))

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.activity:activity:1.10.1")
}

// Runs `node scripts/build.mjs` (src/ -> dist/) before every Android build so the APK always has the current UI.
val buildWeb by tasks.registering(Exec::class) {
    workingDir = rootDir.resolve("..")
    commandLine("node", "scripts/build.mjs")
    inputs.dir(rootDir.resolve("../src"))
    inputs.file(rootDir.resolve("../scripts/build.mjs"))
    outputs.dir(rootDir.resolve("../dist"))
}
tasks.named("preBuild") { dependsOn(buildWeb) }
