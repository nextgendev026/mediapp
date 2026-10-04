package com.afyacommerce.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val ussdChannel = "com.afyacommerce/ussd"
    private val locationChannel = "com.afyacommerce/location"
    private val notificationChannel = "com.afyacommerce/notifications"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        MethodChannel(messenger, ussdChannel).setMethodCallHandler { call, result ->
            when (call.method) {
                "dialUssd" -> {
                    val code = call.argument<String>("ussdCode").orEmpty()
                    val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(code)}"))
                    startActivity(intent)
                    result.success("dialed")
                }
                "sendSms" -> {
                    val phone = call.argument<String>("phone").orEmpty()
                    val body = call.argument<String>("body").orEmpty()
                    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$phone")).putExtra("sms_body", body)
                    startActivity(intent)
                    result.success("opened")
                }
                else -> result.notImplemented()
            }
        }
        MethodChannel(messenger, locationChannel).setMethodCallHandler { call, result ->
            if (call.method == "getCurrentPosition") {
                getCurrentLocation(result)
            } else {
                result.notImplemented()
            }
        }
        MethodChannel(messenger, notificationChannel).setMethodCallHandler { call, result ->
            when (call.method) {
                "initialize" -> {
                    createNotificationChannel()
                    result.success(true)
                }
                "show" -> {
                    showNotification(call.argument<String>("title").orEmpty(), call.argument<String>("body").orEmpty(), call.argument<String>("id").orEmpty())
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun getCurrentLocation(result: MethodChannel.Result) {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            result.error("permission_denied", "Location permission is required", null)
            return
        }
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val location = manager.getProviders(true).mapNotNull { provider -> manager.getLastKnownLocation(provider) }.maxByOrNull { it.time }
        if (location == null) {
            result.error("unavailable", "No recent location is available", null)
            return
        }
        result.success(mapOf("latitude" to location.latitude, "longitude" to location.longitude, "accuracy" to location.accuracy.toDouble()))
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("afya_updates", "AfyaCommerce updates", NotificationManager.IMPORTANCE_DEFAULT)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun showNotification(title: String, body: String, id: String) {
        createNotificationChannel()
        val notification = NotificationCompat.Builder(this, "afya_updates")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .build()
        getSystemService(NotificationManager::class.java).notify(id.hashCode(), notification)
    }
}
