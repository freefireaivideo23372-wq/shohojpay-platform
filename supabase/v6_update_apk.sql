-- Update APK Download Link to Direct ShohojPay.apk Release
update public.site_settings
set apk_download_url = 'https://github.com/freefireaivideo23372-wq/shohojpay-platform/releases/latest/download/ShohojPay.apk'
where id = 1;
