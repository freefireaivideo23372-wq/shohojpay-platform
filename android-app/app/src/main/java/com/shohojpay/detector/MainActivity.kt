package com.shohojpay.detector

import android.Manifest
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var contentContainer: LinearLayout
    private lateinit var subHeaderText: TextView
    private var activeTab = "dashboard"
    private var activeFilter = "All"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        contentContainer = findViewById(R.id.contentContainer)
        subHeaderText = findViewById(R.id.subHeaderText)

        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS),
            101
        )

        findViewById<Button>(R.id.syncNowBtn).setOnClickListener { syncRecentSmsInbox() }
        findViewById<Button>(R.id.tabDashboard).setOnClickListener { switchTab("dashboard") }
        findViewById<Button>(R.id.tabProviders).setOnClickListener { switchTab("providers") }
        findViewById<Button>(R.id.tabBalance).setOnClickListener { switchTab("balance") }
        findViewById<Button>(R.id.tabInsights).setOnClickListener { switchTab("insights") }
        findViewById<Button>(R.id.tabConfig).setOnClickListener { switchTab("config") }

        switchTab("dashboard")
    }

    private fun switchTab(tab: String) {
        activeTab = tab
        val tabs = mapOf(
            "dashboard" to findViewById<Button>(R.id.tabDashboard),
            "providers" to findViewById<Button>(R.id.tabProviders),
            "balance" to findViewById<Button>(R.id.tabBalance),
            "insights" to findViewById<Button>(R.id.tabInsights),
            "config" to findViewById<Button>(R.id.tabConfig)
        )
        tabs.forEach { (k, btn) ->
            btn.setTextColor(if (k == tab) Color.parseColor("#059669") else Color.parseColor("#64748B"))
            btn.setTypeface(null, if (k == tab) Typeface.BOLD else Typeface.NORMAL)
        }
        renderCurrentTab()
    }

    private fun renderCurrentTab() {
        contentContainer.removeAllViews()
        val hasKey = SmsStorage.getApiKey(this).isNotEmpty()
        subHeaderText.text = if (hasKey) "● Connected • Auto SMS Sync Ready" else "⚠ Config ট্যাবে গিয়ে আপনার API Key সেভ করুন"

        when (activeTab) {
            "dashboard" -> renderDashboard()
            "providers" -> renderProviders()
            "balance" -> renderBalance()
            "insights" -> renderInsights()
            "config" -> renderConfig()
        }
    }

    private fun makeCard(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(Color.WHITE)
        setPadding(36, 32, 36, 32)
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        lp.setMargins(0, 0, 0, 26)
        layoutParams = lp
        elevation = 3f
    }

    private fun renderDashboard() {
        // Filter Bar: All | Pending | Failed
        val filterRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.setMargins(0, 0, 0, 24)
            layoutParams = lp
        }
        listOf("All", "Pending", "Failed").forEach { f ->
            val b = Button(this).apply {
                text = f
                textSize = 12f
                isAllCaps = false
                setBackgroundColor(if (activeFilter == f) Color.parseColor("#0284C7") else Color.WHITE)
                setTextColor(if (activeFilter == f) Color.WHITE else Color.parseColor("#334155"))
                val lp = LinearLayout.LayoutParams(0, 100, 1f)
                lp.setMargins(6, 0, 6, 0)
                layoutParams = lp
                setOnClickListener { activeFilter = f; renderCurrentTab() }
            }
            filterRow.addView(b)
        }
        contentContainer.addView(filterRow)

        val logs = SmsStorage.getLogs(this).filter { activeFilter == "All" || it.optString("status") == activeFilter }
        if (logs.isEmpty()) {
            val emptyCard = makeCard()
            emptyCard.addView(TextView(this).apply {
                text = "এখনো কোনো পেমেন্ট SMS সিঙ্ক হয়নি।

১. Config ট্যাবে গিয়ে আপনার API Key সেভ করুন।
২. উপরে ↻ SYNC বাটনে ক্লিক করে ইনবক্স সিঙ্ক করুন।"
                setTextColor(Color.parseColor("#475569"))
                textSize = 14f
            })
            contentContainer.addView(emptyCard)
            return
        }

        logs.forEach { item ->
            val card = makeCard()
            val topRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            topRow.addView(TextView(this).apply {
                text = item.optString("sender", "MFS")
                textSize = 14f
                setTypeface(null, Typeface.BOLD)
                setTextColor(Color.parseColor("#0284C7"))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            topRow.addView(TextView(this).apply {
                text = item.optString("time", "")
                textSize = 11f
                setTextColor(Color.parseColor("#64748B"))
            })
            card.addView(topRow)

            card.addView(TextView(this).apply {
                text = item.optString("body", "")
                textSize = 13f
                setTextColor(Color.parseColor("#0F172A"))
                setPadding(0, 14, 0, 16)
            })

            val btnRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
            val status = item.optString("status", "Pending")
            btnRow.addView(TextView(this).apply {
                text = status
                textSize = 12f
                setTypeface(null, Typeface.BOLD)
                setTextColor(if (status == "Success") Color.parseColor("#059669") else Color.parseColor("#DC2626"))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            btnRow.addView(Button(this).apply {
                text = "Copy"
                textSize = 11f
                setOnClickListener {
                    val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("SMS", item.optString("body")))
                    Toast.makeText(this@MainActivity, "Copied!", Toast.LENGTH_SHORT).show()
                }
            })
            btnRow.addView(Button(this).apply {
                text = "Delete"
                textSize = 11f
                setTextColor(Color.parseColor("#DC2626"))
                setOnClickListener {
                    SmsStorage.deleteLog(this@MainActivity, item.optString("body"))
                    renderCurrentTab()
                }
            })
            card.addView(btnRow)
            contentContainer.addView(card)
        }
    }

    private fun renderProviders() {
        val header = makeCard()
        header.addView(TextView(this).apply { text = "Trusted Providers"; textSize = 18f; setTypeface(null, Typeface.BOLD); setTextColor(Color.parseColor("#0F172A")) })
        header.addView(TextView(this).apply { text = "কোন কোন ওয়ালেটের পেমেন্ট SMS অটো ডিটেক্ট হবে তা অন/অফ করুন:"; textSize = 12f; setTextColor(Color.parseColor("#64748B")) })
        contentContainer.addView(header)

        val list = SmsStorage.getProviders(this)
        list.forEachIndexed { idx, pair ->
            val card = makeCard()
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
            row.addView(TextView(this).apply {
                text = pair.first
                textSize = 15f
                setTypeface(null, Typeface.BOLD)
                setTextColor(Color.parseColor("#0F172A"))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            val sw = Switch(this).apply {
                isChecked = pair.second
                setOnCheckedChangeListener { _, checked ->
                    list[idx] = pair.first to checked
                    SmsStorage.saveProviders(this@MainActivity, list)
                }
            }
            row.addView(sw)
            card.addView(row)
            contentContainer.addView(card)
        }

        contentContainer.addView(Button(this).apply {
            text = "+ ADD PROVIDER"
            setBackgroundColor(Color.parseColor("#0284C7"))
            setTextColor(Color.WHITE)
            setOnClickListener {
                val input = EditText(this@MainActivity).apply { hint = "যেমন: City Bank বা Trust Axiata" }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("নতুন প্রোভাইডার যোগ করুন")
                    .setView(input)
                    .setPositiveButton("যোগ করুন") { _, _ ->
                        val name = input.text.toString().trim()
                        if (name.isNotEmpty()) {
                            list.add(name to true)
                            SmsStorage.saveProviders(this@MainActivity, list)
                            renderCurrentTab()
                        }
                    }
                    .setNegativeButton("বাতিল", null)
                    .show()
            }
        })
    }

    private fun renderBalance() {
        val header = makeCard()
        header.addView(TextView(this).apply { text = "Balance Verification"; textSize = 18f; setTypeface(null, Typeface.BOLD); setTextColor(Color.parseColor("#0F172A")) })
        header.addView(TextView(this).apply { text = "সিম ভিত্তিক ওয়ালেট ব্যালেন্স ভেরিফিকেশন কনফিগার করুন:"; textSize = 12f; setTextColor(Color.parseColor("#64748B")) })
        contentContainer.addView(header)

        val configs = SmsStorage.getBalanceConfigs(this)
        if (configs.isEmpty()) {
            val c = makeCard()
            c.addView(TextView(this).apply { text = "No balance configs yet. নিচের বাটনে ক্লিক করে আপনার সিম ও ওয়ালেট যোগ করুন।"; setTextColor(Color.parseColor("#64748B")) })
            contentContainer.addView(c)
        } else {
            configs.forEach { cfg ->
                val c = makeCard()
                c.addView(TextView(this).apply { text = "✓ $cfg"; textSize = 14f; setTypeface(null, Typeface.BOLD); setTextColor(Color.parseColor("#059669")) })
                contentContainer.addView(c)
            }
        }

        contentContainer.addView(Button(this).apply {
            text = "+ ADD CONFIGURATION"
            setBackgroundColor(Color.parseColor("#0284C7"))
            setTextColor(Color.WHITE)
            setOnClickListener {
                val input = EditText(this@MainActivity).apply { hint = "যেমন: SIM 1 - bKash (01773895998)" }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("ব্যালেন্স কনফিগারেশন যোগ করুন")
                    .setView(input)
                    .setPositiveButton("সেভ") { _, _ ->
                        val v = input.text.toString().trim()
                        if (v.isNotEmpty()) { SmsStorage.addBalanceConfig(this@MainActivity, v); renderCurrentTab() }
                    }
                    .setNegativeButton("বাতিল", null)
                    .show()
            }
        })
    }

    private fun renderInsights() {
        val logs = SmsStorage.getLogs(this)
        val successCount = logs.count { it.optString("status") == "Success" }
        val card = makeCard()
        card.addView(TextView(this).apply { text = "Analytics & Insights"; textSize = 18f; setTypeface(null, Typeface.BOLD); setTextColor(Color.parseColor("#0F172A")) })
        card.addView(TextView(this).apply { text = "
Total Synced Transactions: $successCount"; textSize = 16f; setTypeface(null, Typeface.BOLD); setTextColor(Color.parseColor("#0284C7")) })
        card.addView(TextView(this).apply { text = "Total Captured Messages: ${logs.size}"; textSize = 14f; setTextColor(Color.parseColor("#475569")) })
        contentContainer.addView(card)
    }

    private fun renderConfig() {
        val apiCard = makeCard()
        apiCard.addView(TextView(this).apply { text = "API Configuration"; textSize = 17f; setTypeface(null, Typeface.BOLD); setTextColor(Color.parseColor("#0F172A")) })
        val keyInput = EditText(this).apply {
            hint = "sp_live_..."
            setText(SmsStorage.getApiKey(this@MainActivity))
            setPadding(24, 24, 24, 24)
        }
        apiCard.addView(keyInput)
        apiCard.addView(Button(this).apply {
            text = "SAVE API KEY"
            setBackgroundColor(Color.parseColor("#059669"))
            setTextColor(Color.WHITE)
            setOnClickListener {
                SmsStorage.saveApiKey(this@MainActivity, keyInput.text.toString())
                Toast.makeText(this@MainActivity, "API Key Saved!", Toast.LENGTH_SHORT).show()
                renderCurrentTab()
            }
        })
        contentContainer.addView(apiCard)

        val permCard = makeCard()
        permCard.addView(TextView(this).apply { text = "Permissions & Background Run"; textSize = 17f; setTypeface(null, Typeface.BOLD); setTextColor(Color.parseColor("#0F172A")) })
        val hasSms = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        permCard.addView(TextView(this).apply {
            text = if (hasSms) "✓ Receive & Read SMS: ALLOWED" else "✕ SMS Permission Denied (Android 13/14/15-এ নিচের বাটন চেপে 'Allow restricted settings' অন করুন)"
            setTextColor(if (hasSms) Color.parseColor("#059669") else Color.parseColor("#DC2626"))
            setPadding(0, 12, 0, 16)
        })
        permCard.addView(Button(this).apply {
            text = "OPEN APP SETTINGS (ALLOW SMS)"
            setBackgroundColor(Color.parseColor("#0284C7"))
            setTextColor(Color.WHITE)
            setOnClickListener {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            }
        })
        contentContainer.addView(permCard)
    }

    private fun syncRecentSmsInbox() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "আগে Config ট্যাব থেকে SMS Permission অন করুন!", Toast.LENGTH_LONG).show()
            switchTab("config")
            return
        }
        Toast.makeText(this, "Syncing recent payment SMS...", Toast.LENGTH_SHORT).show()
        thread {
            var count = 0
            try {
                val cursor = contentResolver.query(Uri.parse("content://sms/inbox"), arrayOf("address", "body"), null, null, "date DESC LIMIT 25")
                cursor?.use {
                    while (it.moveToNext()) {
                        val sender = it.getString(0) ?: ""
                        val body = it.getString(1) ?: ""
                        if (SmsStorage.isProviderAllowed(this, sender, body)) {
                            SmsStorage.pushToServerSync(this, sender, body)
                            count++
                        }
                    }
                }
            } catch (e: Exception) { e.printStackTrace() }
            runOnUiThread {
                Toast.makeText(this, "Sync সম্পন্ন! ($count টি পেমেন্ট মেসেজ চেক হয়েছে)", Toast.LENGTH_LONG).show()
                renderCurrentTab()
            }
        }
    }
}
