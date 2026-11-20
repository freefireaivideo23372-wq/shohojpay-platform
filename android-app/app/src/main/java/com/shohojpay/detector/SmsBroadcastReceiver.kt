package com.shohojpay.detector

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import kotlin.concurrent.thread

class SmsBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val sender = messages[0].originatingAddress ?: "MFS"
        val body = messages.joinToString("") { it.messageBody }

        if (SmsStorage.isProviderAllowed(context, sender, body)) {
            SmsStorage.addOrUpdateLog(context, sender, body, "Pending")
            thread {
                SmsStorage.pushToServerSync(context, sender, body)
            }
        }
    }
}
