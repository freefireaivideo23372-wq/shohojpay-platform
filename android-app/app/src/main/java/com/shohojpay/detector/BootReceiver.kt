package com.shohojpay.detector

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED && SmsStorage.getApiKey(context).isNotEmpty()) {
            val svc = Intent(context, ShohojPayService::class.java)
            ContextCompat.startForegroundService(context, svc)
        }
    }
}
