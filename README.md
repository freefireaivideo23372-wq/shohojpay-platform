# 🚀 ShohojPay (সহজপে) — Instant MFS Payment Automation Platform

বাংলাদেশের বিকাশ (bKash), নগদ (Nagad), রকেট (Rocket) এবং উপায় (Upay)-এর পার্সোনাল ও এজেন্ট "Send Money" ও "Cash Out" স্বয়ংক্রিয়ভাবে ০.৩ সেকেন্ডে ভেরিফাই এবং অটো-অ্যাপ্রুভ করার সার্ভারলেস পেমেন্ট প্ল্যাটফর্ম।

---

## 📁 প্রজেক্ট স্ট্রাকচার (Project Structure)

```
shohojpay-platform/
├── api/
│   ├── create-payment.js     # নতুন পেমেন্ট ইনভয়েস তৈরির API
│   ├── sms-webhook.js        # মোবাইল থেকে SMS আসলে পেমেন্ট অটো-অ্যাপ্রুভ করার API
│   └── verify-payment.js     # চেকআউট পেজ থেকে TrxID ম্যানুয়াল ভেরিফিকেশন API
├── public/
│   └── index.html            # লাইভ প্রিমিয়াম চেকআউট পেজ ও মার্চেন্ট ড্যাশবোর্ড
├── supabase/
│   └── schema.sql            # Supabase ডাটাবেস টেবিল ও রিয়েলটাইম পলিসি
├── android-app/              # অ্যান্ড্রয়েড SMS ডিটেক্টর নেটিভ অ্যাপ
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/shohojpay/detector/
│   │   │   ├── MainActivity.kt
│   │   │   └── SmsBroadcastReceiver.kt
│   │   └── res/
│   ├── build.gradle
│   └── settings.gradle
├── .github/workflows/
│   └── build-apk.yml         # GitHub Actions দিয়ে অটোমেটিক APK বিল্ড করার স্ক্রিপ্ট
├── package.json
└── vercel.json
```

---

## ⚡ স্টেপ-বাই-স্টেপ সেটআপ গাইড (৩টি সহজ ধাপ)

### ধাপ ১: Supabase ডাটাবেস সেটআপ
1. [supabase.com](https://supabase.com)-এ গিয়ে **"Sign in with Google"** বা GitHub দিয়ে লগইন করুন।
2. একটি নতুন প্রোজেক্ট তৈরি করুন (Name: `shohojpay`).
3. বাম পাশের মেন্যু থেকে **SQL Editor**-এ যান।
4. `supabase/schema.sql` ফাইলের পুরো কোডটি কপি করে পেস্ট করে **Run** চাপুন।
5. **Project Settings -> API**-তে গিয়ে নিচের ২টি তথ্য সংগ্রহ করুন:
   - **Project URL** (`https://xyz.supabase.co`)
   - **service_role secret key** (`eyJhbGciOi...`)

### ধাপ ২: Vercel-এ ১-ক্লিকে ডিপ্লয়
1. [vercel.com](https://vercel.com)-এ লগইন করুন।
2. **"Add New Project"** সিলেক্ট করে এই GitHub রিপোজিটরিটি সিলেক্ট করুন।
3. **Environment Variables** সেকশনে নিচের ৩টি ভেরিয়েবল অ্যাড করুন:
   - `SUPABASE_URL` = আপনার Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = আপনার Supabase service_role Key
   - `MERCHANT_API_KEY` = `sp_live_98a72b41c65d89e01f23a45b`
4. **Deploy** বাটনে ক্লিক করুন! কয়েক সেকেন্ডে আপনার ওয়েবসাইট লাইভ হয়ে যাবে (যেমন: `https://shohojpay.vercel.app`)।

### ধাপ ৩: মোবাইলে SMS ডিটেক্টর অ্যাপ ইনস্টল
1. GitHub রিপোজিটরির **Actions** ট্যাবে যান -> সর্বশেষ রান হওয়া **Build ShohojPay Android SMS Detector APK**-তে ক্লিক করুন।
2. **Artifacts** থেকে `ShohojPay-SMS-Detector-APK` ডাউনলোড করে ফোনে ইনস্টল করুন।
3. অ্যাপটি খুলে:
   - **Webhook URL:** `https://your-project.vercel.app/api/sms-webhook`
   - **API Key:** `sp_live_98a72b41c65d89e01f23a45b`
   বসিয়ে **Save** করুন এবং SMS পারমিশন অ্যালাউ করুন।
4. ব্যস! এখন ওই ফোনে কেউ Send Money বা Cash Out করলেই সাথে সাথে কাস্টমারের পেমেন্ট অটো-অ্যাপ্রুভ হয়ে যাবে!
