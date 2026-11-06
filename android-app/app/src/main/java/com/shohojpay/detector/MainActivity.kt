package com.shohojpay.detector

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private val PERMISSION_REQUEST_CODE = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val etWebhookUrl = findViewById<EditText>(R.id.etWebhookUrl)
        val etApiKey = findViewById<EditText>(R.id.etApiKey)
        val btnSave = findViewById<Button>(R.id.btnSave)
        val btnTest = findViewById<Button>(R.id.btnTest)
        val tvStatus = findViewById<TextView>(R.id.tvStatus)
        val tvLogs = findViewById<TextView>(R.id.tvLogs)

        val prefs = getSharedPreferences("ShohojPayPrefs", Context.MODE_PRIVATE)
        val savedUrl = prefs.getString("webhook_url", "https://your-project.vercel.app/api/sms-webhook")
        val savedKey = prefs.getString("api_key", "sp_live_98a72b41c65d89e01f23a45b")

        etWebhookUrl.setText(savedUrl)
        etApiKey.setText(savedKey)

        checkAndRequestPermissions()

        btnSave.setOnClickListener {
            val url = etWebhookUrl.text.toString().trim()
            val key = etApiKey.text.toString().trim()

            if (url.isEmpty() || key.isEmpty()) {
                Toast.makeText(this, "Please enter both Webhook URL and API Key", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            prefs.edit()
                .putString("webhook_url", url)
                .putString("api_key", key)
                .apply()

            Toast.makeText(this, "Settings saved successfully!", Toast.LENGTH_SHORT).show()
        }

        btnTest.setOnClickListener {
            val url = etWebhookUrl.text.toString().trim()
            val key = etApiKey.text.toString().trim()

            tvLogs.text = "Sending test ping to: $url..."

            thread {
                try {
                    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                        setRequestProperty("shohojpay-api-key", key)
                        connectTimeout = 8000
                        readTimeout = 8000
                        doOutput = true
                    }

                    val testPayload = JSONObject().apply {
                        put("sender", "bKash")
                        put("message", "Test ping from ShohojPay Detector App")
                    }

                    OutputStreamWriter(conn.outputStream).use { it.write(testPayload.toString()) }
                    val code = conn.responseCode
                    conn.disconnect()

                    runOnUiThread {
                        tvLogs.text = "Server responded with HTTP code: $code\nWebhook connection active!"
                        Toast.makeText(this@MainActivity, "Connection Test: HTTP $code", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        tvLogs.text = "Connection test failed: ${e.localizedMessage}"
                        Toast.makeText(this@MainActivity, "Test Failed: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val tvStatus = findViewById<TextView>(R.id.tvStatus)
        if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            tvStatus.text = "Status: Active & Ready (SMS Granted)"
            tvStatus.setTextColor(ContextCompat.getColor(this, R.color.primary))
        } else {
            tvStatus.text = "Status: Warning (SMS Permission Denied)"
            tvStatus.setTextColor(ContextCompat.getColor(this, R.color.nagad))
        }
    }
}
