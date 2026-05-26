# RainGuard AI - منصة إنذار المطر المحلي

هذه نسخة حقيقية تتكون من:

1. Backend API باستخدام FastAPI
2. Frontend يعمل على الجوال
3. تحليل احتمالية المطر من بيانات Open-Meteo

## الملفات

- backend/main.py
- backend/requirements.txt
- backend/render.yaml
- frontend/index.html
- frontend/style.css
- frontend/app.js
- frontend/config.js

## تشغيل Backend محليًا

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

رابط التجربة:

```text
http://127.0.0.1:8000/rain-alert?lat=21.4858&lon=39.1925&name=Jeddah
```

## رفع Backend على Render

1. ارفع مجلد المشروع على GitHub.
2. افتح render.com.
3. New Web Service.
4. اختر المستودع.
5. Root Directory: backend
6. Build Command:
   pip install -r requirements.txt
7. Start Command:
   uvicorn main:app --host 0.0.0.0 --port $PORT
8. بعد الرفع انسخ رابط الخدمة.

## تشغيل Frontend

افتح ملف:

```text
frontend/index.html
```

ثم من تبويب API داخل التطبيق ضع رابط Backend الذي حصلت عليه من Render.

## ملاحظة

النظام يستخدم Open-Meteo Forecast API. النتيجة تقديرية وليست بديلًا عن تنبيهات المركز الوطني للأرصاد.