package com.shohojpay.detector

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object SmsStorage {
    private const val PREF_NAME = "ShohojPayPrefs"
    const val DEFAULT_WEBHOOK = "https://shohojpay-platform.vercel.app/api/sms-webhook"

    fun getApiKey(ctx: Context): String =
        ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString("api_key", "") ?: ""

    fun saveApiKey(ctx: Context, key: String) {
        ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit()
            .putString("api_key", key.trim())
            .putString("webhook_url", DEFAULT_WEBHOOK)
            .apply()
    }

    fun getProviders(ctx: Context): MutableList<Pair<String, Boolean>> {
        val prefs = ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString("providers_json", null)
        if (raw == null) {
            return mutableListOf(
                "bKash" to true,
                "Nagad" to true,
                "Rocket (16216)" to true,
                "Upay" to true,
                "Cellfin" to true,
                "Tally Pay" to true,
                "Pubali Bank" to false
            )
        }
        val list = mutableListOf<Pair<String, Boolean>>()
        val arr = JSONArray(raw)
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            list.add(o.getString("name") to o.getBoolean("enabled"))
        }
        return list
    }

    fun saveProviders(ctx: Context, list: List<Pair<String, Boolean>>) {
        val arr = JSONArray()
        list.forEach { (name, enabled) ->
            arr.put(JSONObject().apply {
                put("name", name)
                put("enabled", enabled)
            })
        }
        ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit()
            .putString("providers_json", arr.toString())
            .apply()
    }

    fun isProviderAllowed(ctx: Context, sender: String, body: String): Boolean {
        val active = getProviders(ctx).filter { it.second }.map { it.first.lowercase() }
        val sLow = sender.lowercase()
        val bLow = body.lowercase()
        if (active.any { p ->
                val key = p.split(" ")[0]
                sLow.contains(key) || bLow.contains(key) || (p.contains("16216") && (sLow.contains("16216") || bLow.contains("rocket")))
            }) return true
        return bLow.contains("trxid") || bLow.contains("txnid")
    }

    fun getLogs(ctx: Context): MutableList<JSONObject> {
        val raw = ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString("sms_logs_json", "[]") ?: "[]"
        val arr = JSONArray(raw)
        val out = mutableListOf<JSONObject>()
        for (i in 0 until arr.length()) out.add(arr.getJSONObject(i))
        return out
    }

    fun saveLogs(ctx: Context, logs: List<JSONObject>) {
        val arr = JSONArray()
        logs.take(60).forEach { arr.put(it) }
        ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit()
            .putString("sms_logs_json", arr.toString())
            .putLong("last_sync_ts", System.currentTimeMillis())
            .apply()
    }

    fun addOrUpdateLog(ctx: Context, sender: String, body: String, status: String) {
        val logs = getLogs(ctx)
        val existingIdx = logs.indexOfFirst { it.optString("body") == body }
        val timeStr = SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()).format(Date())
        val obj = JSONObject().apply {
            put("sender", sender)
            put("body", body)
            put("status", status)
            put("time", timeStr)
        }
        if (existingIdx >= 0) logs[existingIdx] = obj else logs.add(0, obj)
        saveLogs(ctx, logs)
    }

    fun deleteLog(ctx: Context, body: String) {
        val logs = getLogs(ctx).filter { it.optString("body") != body }
        saveLogs(ctx, logs)
    }

    fun getBalanceConfigs(ctx: Context): MutableList<String> {
        val raw = ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString("bal_configs", "[]") ?: "[]"
        val arr = JSONArray(raw)
        val out = mutableListOf<String>()
        for (i in 0 until arr.length()) out.add(arr.getString(i))
        return out
    }

    fun addBalanceConfig(ctx: Context, label: String) {
        val list = getBalanceConfigs(ctx)
        list.add(0, label)
        val arr = JSONArray()
        list.forEach { arr.put(it) }
        ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit().putString("bal_configs", arr.toString()).apply()
    }

    fun pushToServerSync(ctx: Context, sender: String, body: String): Boolean {
        val apiKey = getApiKey(ctx)
        if (apiKey.isEmpty()) {
            addOrUpdateLog(ctx, sender, body, "Failed")
            return false
        }
        return try {
            val conn = (URL(DEFAULT_WEBHOOK).openConnection() as HttpURLConnection).apply {
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
            val code = conn.responseCode
            conn.disconnect()
            val ok = code in 200..299 || code == 409
            addOrUpdateLog(ctx, sender, body, if (ok) "Success" else "Failed")
            ok
        } catch (e: Exception) {
            addOrUpdateLog(ctx, sender, body, "Pending")
            false
        }
    }
}
