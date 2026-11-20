package com.shohojpay.detector

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class SmsBroadcastReceiver : BroadcastReceiver() {
    private val MFS_SENDERS = listOf("bkash", "nagad", "16216", "upay", "16247", "16167")
    private val KEYWORDS = listOf("trxid", "txnid", "received", "cash out", "cash-out", "cash in")

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val sender = messages[0].originatingAddress ?: ""
        val body = messages.joinToString("") { it.messageBody }

        if (MFS_SENDERS.any { sender.contains(it, true) } || KEYWORDS.any { body.contains(it, true) }) {
            val prefs = context.getSharedPreferences("ShohojPayPrefs", Context.MODE_PRIVATE)
            val webhookUrl = prefs.getString("webhook_url", "https://shohojpay-platform.vercel.app/api/sms-webhook") ?: return
            val apiKey = prefs.getString("api_key", "") ?: return
            if (apiKey.isEmpty()) return

            thread {
                try {
                    val conn = (URL(webhookUrl).openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                        setRequestProperty("shohojpay-api-key", apiKey)
                        connectTimeout = 8000
                        readTimeout = 8000
                        doOutput = true
                    }
                    val payload = JSONObject().apply {
                        put("sender", sender)
                        put("message", body)
                    }
                    OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }
                    conn.responseCode
                    conn.disconnect()
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }
}
