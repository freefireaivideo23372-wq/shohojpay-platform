package com.shohojpay.detector

import android.Manifest
import android.content.Context
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS),
            101
        )

        val prefs = getSharedPreferences("ShohojPayPrefs", Context.MODE_PRIVATE)
        val apiKeyInput = findViewById<EditText>(R.id.apiKeyInput)
        val saveBtn = findViewById<Button>(R.id.saveBtn)
        val statusText = findViewById<TextView>(R.id.statusText)

        val savedKey = prefs.getString("api_key", "") ?: ""
        apiKeyInput.setText(savedKey)
        if (savedKey.isNotEmpty()) {
            statusText.text = "● সচল আছে! bKash / Nagad / Rocket মেসেজ অটো ডিটেক্ট হচ্ছে।"
        }

        saveBtn.setOnClickListener {
            val key = apiKeyInput.text.toString().trim()
            if (key.isEmpty()) {
                Toast.makeText(this, "সঠিক API Key দিন!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            prefs.edit()
                .putString("api_key", key)
                .putString("webhook_url", "https://shohojpay-platform.vercel.app/api/sms-webhook")
                .apply()
            statusText.text = "● সচল আছে! এখন পেমেন্ট SMS আসলেই অটো ভেরিফাই হবে।"
            Toast.makeText(this, "ShohojPay অটো ডিটেক্টর চালু হয়েছে!", Toast.LENGTH_LONG).show()
        }
    }
}
