package com.shohojpay.detector

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class ShohojPayService : Service() {

    companion object {
        const val CHANNEL_ID = "shohojpay_live_channel"
        const val ALERT_CHANNEL_ID = "shohojpay_payment_alert"

        fun showPaymentNotification(ctx: Context, title: String, msg: String) {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val ch = NotificationChannel(ALERT_CHANNEL_ID, "Payment Sync Alerts", NotificationManager.IMPORTANCE_HIGH)
                nm.createNotificationChannel(ch)
            }
            val notif = NotificationCompat.Builder(ctx, ALERT_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_shohojpay_logo)
                .setContentTitle(title)
                .setContentText(msg)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build()
            nm.notify((System.currentTimeMillis() % 10000).toInt(), notif)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        val openIntent = Intent(this, MainActivity::class.java)
        val pi = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_shohojpay_logo)
            .setContentTitle("⚡ ShohojPay অটো-ভেরিফিকেশন চালু আছে")
            .setContentText("bKash, Nagad, Rocket পেমেন্ট SMS ২৪/৭ ডিটেক্ট হচ্ছে...")
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(1001, notification)
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "ShohojPay Background Service", NotificationManager.IMPORTANCE_LOW)
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(ch)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
