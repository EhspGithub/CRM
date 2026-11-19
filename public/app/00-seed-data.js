// نسیم رهایی — داده‌های نمونه (فقط حالت مرورگر/دمو)، تنظیمات پیش‌فرض و ثابت‌ها
// (اسکریپت کلاسیک؛ همه فایل‌های public/app به ترتیب شماره در یک دامنه سراسری اجرا می‌شوند)

// Seed Database with beautiful, fully compliant dummy dataset matching your exact specs!
const initialDummyPatients = [
    {
        id: "OMID-1004", campHistory: "دارد", campStays: [{ start: "1401/03/10", end: "1401/04/08" }, { start: "1403/09/01", end: "1403/10/05" }], code: 1004, fullName: "علیرضا کریمی", nationalId: "0018475293", birthdate: "1370/04/12", age: 35, gender: "مرد", marital: "متأهل", employment: "شاغل", job: "راننده تاکسی", phone: "09123456789", admissionDate: "1404/05/10", insurance: "دارد", attempts: "۲ تا ۵ بار", counselor: "خانم ابراهیمی", substance: "هروئین", substanceOther: "", startAge: 22, duration: 13, medHistory: ["دیابت", "بیماری کبدی", "افسردگی"], medicalNotes: "علائم حاد کبد، نیاز به پیگیری دوز دارویی متادون.", initialDrug: "ش متادون", initialDosage: 40.0, currentDrug: "ش متادون", currentDosage: 40.0, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "OMID-1003", campHistory: "ندارد", campStays: [], code: 1003, fullName: "فاطمه نیک‌روان", nationalId: "0452938475", birthdate: "1376/12/20", age: 29, gender: "زن", marital: "مجرد", employment: "دانش‌آموز/دانشجو", job: "دانشجو", phone: "09198765432", admissionDate: "1404/08/15", insurance: "ندارد", attempts: "هیچ‌وقت ترک نکرده", counselor: "آقای فتحی", substance: "ماریجوانا / گل", substanceOther: "", startAge: 19, duration: 10, medHistory: ["اختلال اضطرابی", "اختلال خواب"], medicalNotes: "اضطراب شدید و سابقه پنیک اتک دوره ای.", initialDrug: "روان درمانی", initialDosage: 0, currentDrug: "روان درمانی", currentDosage: 0, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "OMID-1002", code: 1002, fullName: "فرهاد صالحی", nationalId: "1283948572", birthdate: "1359/01/10", age: 47, gender: "مرد", marital: "مطلقه - متارکه", employment: "بیکار", job: "", phone: "09351234567", admissionDate: "1403/10/01", insurance: "دارد", attempts: "بیش از ۵ بار", counselor: "خانم ابراهیمی", substance: "شیشه (مت‌آمفتامین)", substanceOther: "", startAge: 25, duration: 22, medHistory: ["فشار خون", "نارسایی قلبی"], medicalNotes: "سابقه عروق کرونر، تحت پایش قلبی روزانه دوز بوپرنورفین.", initialDrug: "بوپرنورفین", initialDosage: 2.0, currentDrug: "بوپرنورفین", currentDosage: 3.0, status: "فعال", attendance: "نامنظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "OMID-1001", code: 1001, fullName: "امید هاشمی", nationalId: "0098472534", birthdate: "1363/09/15", age: 42, gender: "مرد", marital: "متأهل", employment: "شاغل", job: "کسب و کار آزاد", phone: "09121112233", admissionDate: "1403/05/20", insurance: "دارد", attempts: "۱ بار", counselor: "آقای فتحی", substance: "تریاک", substanceOther: "", startAge: 30, duration: 12, medHistory: ["بیماری کلیوی"], medicalNotes: "بدون شکایت حاد روانپزشکی.", initialDrug: "اپیوم", initialDosage: 15.0, currentDrug: "اپیوم", currentDosage: 10.0, status: "غیرفعال", attendance: "غیبت", deactiveReason: "بهبودی کامل (ترخیص)", deactiveNotes: "طرح ترخیص مراجع با موفقیت تایید بالینی شد."
    },
    {
        id: "P-980", code: 980, fullName: "رضا احمدی", nationalId: "0011223344", birthdate: "1355/02/10", age: 50, gender: "مرد", marital: "متأهل", employment: "شاغل", job: "بنا", phone: "09121111111", admissionDate: "1403/01/15", insurance: "دارد", attempts: "بیش از ۵ بار", counselor: "آقای فتحی", substance: "تریاک", substanceOther: "", startAge: 25, duration: 25, medHistory: ["فشار خون"], medicalNotes: "مشکلات فشار خون، تحت کنترل.", initialDrug: "اپیوم", initialDosage: 20, currentDrug: "اپیوم", currentDosage: 15, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-981", campHistory: "دارد", campStays: [{ start: "1402/11/15", end: "1403/01/20" }], code: 981, fullName: "سارا حسینی", nationalId: "0022334455", birthdate: "1368/05/22", age: 37, gender: "زن", marital: "مطلقه - متارکه", employment: "بیکار", job: "", phone: "09122222222", admissionDate: "1403/02/10", insurance: "ندارد", attempts: "۲ تا ۵ بار", counselor: "خانم ابراهیمی", substance: "هروئین", substanceOther: "", startAge: 20, duration: 17, medHistory: ["افسردگی"], medicalNotes: "سابقه افسردگی شدید، ارجاع به روانپزشک.", initialDrug: "ش متادون", initialDosage: 60, currentDrug: "ش متادون", currentDosage: 40, status: "فعال", attendance: "نامنظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-982", campHistory: "ندارد", campStays: [], code: 982, fullName: "مهدی کریمی", nationalId: "0033445566", birthdate: "1375/08/11", age: 30, gender: "مرد", marital: "مجرد", employment: "شاغل", job: "فروشنده", phone: "09123333333", admissionDate: "1403/06/05", insurance: "دارد", attempts: "۱ بار", counselor: "آقای فتحی", substance: "شیشه (مت‌آمفتامین)", substanceOther: "", startAge: 22, duration: 8, medHistory: ["اختلال اضطرابی"], medicalNotes: "پارانویا خفیف به علت مصرف شیشه.", initialDrug: "روان درمانی", initialDosage: 0, currentDrug: "روان درمانی", currentDosage: 0, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-983", campHistory: "ندارد", campStays: [], code: 983, fullName: "علی مرادی", nationalId: "0044556677", birthdate: "1345/11/02", age: 60, gender: "مرد", marital: "متأهل", employment: "بازنشسته", job: "کارمند", phone: "09124444444", admissionDate: "1403/03/20", insurance: "دارد", attempts: "هیچ‌وقت ترک نکرده", counselor: "خانم ابراهیمی", substance: "شیره", substanceOther: "", startAge: 40, duration: 20, medHistory: ["دیابت", "بیماری ایسکمیک قلب"], medicalNotes: "دیابت کنترل شده با متفورمین.", initialDrug: "بوپرنورفین", initialDosage: 4, currentDrug: "بوپرنورفین", currentDosage: 2, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-984", campHistory: "ندارد", campStays: [], code: 984, fullName: "زهرا نجفی", nationalId: "0055667788", birthdate: "1380/01/14", age: 25, gender: "زن", marital: "مجرد", employment: "دانش‌آموز/دانشجو", job: "دانشجو", phone: "09125555555", admissionDate: "1403/07/01", insurance: "ندارد", attempts: "۱ بار", counselor: "خانم ابراهیمی", substance: "ماریجوانا / گل", substanceOther: "", startAge: 18, duration: 7, medHistory: [], medicalNotes: "اضطراب امتحان و مصرف گل.", initialDrug: "روان درمانی", initialDosage: 0, currentDrug: "روان درمانی", currentDosage: 0, status: "فعال", attendance: "نامنظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-985", campHistory: "دارد", campStays: [{ start: "1400/06/01", end: "1400/07/01" }, { start: "1402/02/10", end: "1402/03/15" }, { start: "1404/12/01", end: "1405/01/15" }], code: 985, fullName: "محمد رضایی", nationalId: "0066778899", birthdate: "1352/03/30", age: 53, gender: "مرد", marital: "متأهل", employment: "شاغل", job: "راننده", phone: "09126666666", admissionDate: "1402/10/12", insurance: "دارد", attempts: "۲ تا ۵ بار", counselor: "آقای فتحی", substance: "تریاک", substanceOther: "", startAge: 25, duration: 28, medHistory: ["بیماری کلیوی"], medicalNotes: "مصرف جهت تسکین درد مزمن کمر.", initialDrug: "اپیوم", initialDosage: 30, currentDrug: "اپیوم", currentDosage: 10, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-986", campHistory: "ندارد", campStays: [], code: 986, fullName: "مریم ابراهیمی", nationalId: "0077889900", birthdate: "1360/09/15", age: 45, gender: "زن", marital: "متأهل", employment: "شاغل", job: "آرایشگر", phone: "09127777777", admissionDate: "1401/11/05", insurance: "دارد", attempts: "هیچ‌وقت ترک نکرده", counselor: "خانم ابراهیمی", substance: "تریاک", substanceOther: "", startAge: 35, duration: 10, medHistory: ["سردرد میگرنی"], medicalNotes: "شروع مصرف با همسر.", initialDrug: "ق متادون", initialDosage: 20, currentDrug: "ق متادون", currentDosage: 5, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-987", campHistory: "دارد", campStays: [{ start: "1405/05/20", end: "1405/07/01" }], code: 987, fullName: "حسین جعفری", nationalId: "0088990011", birthdate: "1372/12/01", age: 33, gender: "مرد", marital: "مجرد", employment: "بیکار", job: "", phone: "09128888888", admissionDate: "1402/05/20", insurance: "ندارد", attempts: "بیش از ۵ بار", counselor: "آقای فتحی", substance: "شیشه (مت‌آمفتامین)", substanceOther: "", startAge: 20, duration: 13, medHistory: [], medicalNotes: "تخریب دندان‌ها و کاهش وزن شدید.", initialDrug: "بوپرنورفین", initialDosage: 8, currentDrug: "بوپرنورفین", currentDosage: 8, status: "غیرفعال", attendance: "غیبت", deactiveReason: "انصراف از درمان", deactiveNotes: "عدم پاسخگویی به تماس‌ها پس از سه ماه."
    },
    {
        id: "P-988", campHistory: "ندارد", campStays: [], code: 988, fullName: "ندا قاسمی", nationalId: "0099001122", birthdate: "1365/06/18", age: 40, gender: "زن", marital: "مطلقه - متارکه", employment: "شاغل", job: "منشی", phone: "09129999999", admissionDate: "1403/04/10", insurance: "دارد", attempts: "۱ بار", counselor: "خانم ابراهیمی", substance: "الکل", substanceOther: "", startAge: 28, duration: 12, medHistory: ["بیماری کبدی"], medicalNotes: "آنزیم‌های کبدی بالا در آزمایش اولیه.", initialDrug: "روان درمانی", initialDosage: 0, currentDrug: "روان درمانی", currentDosage: 0, status: "فعال", attendance: "نامنظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-989", campHistory: "دارد", campStays: [{ start: "1401/08/01", end: "1401/09/10" }, { start: "1404/04/05", end: "" }], code: 989, fullName: "حسن جلالی", nationalId: "0100112233", birthdate: "1358/04/04", age: 47, gender: "مرد", marital: "متأهل", employment: "شاغل", job: "کارگر", phone: "09131111111", admissionDate: "1402/08/15", insurance: "دارد", attempts: "۲ تا ۵ بار", counselor: "آقای فتحی", substance: "هروئین", substanceOther: "", startAge: 22, duration: 25, medHistory: ["هپاتیت C"], medicalNotes: "سابقه تزریق در گذشته، اکنون مصرف تدخینی.", initialDrug: "ش متادون", initialDosage: 80, currentDrug: "ش متادون", currentDosage: 60, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-990", campHistory: "ندارد", campStays: [], code: 990, fullName: "فاطمه طاهری", nationalId: "0111223344", birthdate: "1348/10/25", age: 57, gender: "زن", marital: "همسر فوت شده", employment: "خانه دار", job: "", phone: "09132222222", admissionDate: "1401/02/01", insurance: "ندارد", attempts: "بیش از ۵ بار", counselor: "خانم ابراهیمی", substance: "شیره", substanceOther: "", startAge: 35, duration: 22, medHistory: ["فشار خون"], medicalNotes: "مصرف به دلیل دردهای مفصلی شروع شده است.", initialDrug: "ق متادون", initialDosage: 40, currentDrug: "ق متادون", currentDosage: 20, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-991", code: 991, fullName: "سعید اکبری", nationalId: "0122334455", birthdate: "1378/02/14", age: 27, gender: "مرد", marital: "مجرد", employment: "دانش‌آموز/دانشجو", job: "", phone: "09133333333", admissionDate: "1403/01/10", insurance: "دارد", attempts: "هیچ‌وقت ترک نکرده", counselor: "آقای فتحی", substance: "شیشه (مت‌آمفتامین)", substanceOther: "", startAge: 19, duration: 8, medHistory: ["اختلال خواب"], medicalNotes: "بی‌خوابی‌های چند روزه و توهمات شنیداری.", initialDrug: "بوپرنورفین", initialDosage: 2, currentDrug: "روان درمانی", currentDosage: 0, status: "فعال", attendance: "نامنظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-992", campHistory: "ندارد", campStays: [], code: 992, fullName: "الناز صادقی", nationalId: "0133445566", birthdate: "1369/07/07", age: 36, gender: "زن", marital: "متأهل", employment: "شاغل", job: "حسابدار", phone: "09134444444", admissionDate: "1400/05/20", insurance: "دارد", attempts: "۱ بار", counselor: "خانم ابراهیمی", substance: "تریاک", substanceOther: "", startAge: 28, duration: 8, medHistory: [], medicalNotes: "بدون مشکل جسمی خاص.", initialDrug: "اپیوم", initialDosage: 10, currentDrug: "اپیوم", currentDosage: 0, status: "غیرفعال", attendance: "غیبت", deactiveReason: "بهبودی کامل (ترخیص)", deactiveNotes: "تکمیل موفقیت آمیز دوره کاهش دوز."
    },
    {
        id: "P-993", campHistory: "دارد", campStays: [], code: 993, fullName: "امیر محمدپور", nationalId: "0144556677", birthdate: "1371/03/12", age: 34, gender: "مرد", marital: "مجرد", employment: "شاغل", job: "پیک موتوری", phone: "09135555555", admissionDate: "1403/08/01", insurance: "ندارد", attempts: "۲ تا ۵ بار", counselor: "آقای فتحی", substance: "هروئین", substanceOther: "", startAge: 20, duration: 14, medHistory: [], medicalNotes: "نیاز به ارجاع به دندانپزشکی.", initialDrug: "ش متادون", initialDosage: 50, currentDrug: "ش متادون", currentDosage: 50, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-994", campHistory: "ندارد", campStays: [], code: 994, fullName: "لیلا قنبری", nationalId: "0155667788", birthdate: "1355/11/22", age: 50, gender: "زن", marital: "متأهل", employment: "خانه دار", job: "", phone: "09136666666", admissionDate: "1402/11/15", insurance: "دارد", attempts: "هیچ‌وقت ترک نکرده", counselor: "خانم ابراهیمی", substance: "شیره", substanceOther: "", startAge: 40, duration: 10, medHistory: ["بیماری ایسکمیک قلب"], medicalNotes: "تپش قلب گاه به گاه.", initialDrug: "بوپرنورفین", initialDosage: 2, currentDrug: "بوپرنورفین", currentDosage: 1, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-995", code: 995, fullName: "پیمان نوری", nationalId: "0166778899", birthdate: "1363/01/05", age: 42, gender: "مرد", marital: "مطلقه - متارکه", employment: "بیکار", job: "", phone: "09137777777", admissionDate: "1403/05/10", insurance: "ندارد", attempts: "بیش از ۵ بار", counselor: "آقای فتحی", substance: "الکل", substanceOther: "", startAge: 18, duration: 24, medHistory: ["بیماری کبدی"], medicalNotes: "کبد چرب گرید ۳، خطر سیروز کبدی، تاکید بر عدم مصرف مطلق.", initialDrug: "روان درمانی", initialDosage: 0, currentDrug: "روان درمانی", currentDosage: 0, status: "فعال", attendance: "نامنظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-996", code: 996, fullName: "نسیم کمالی", nationalId: "0177889900", birthdate: "1376/08/30", age: 29, gender: "زن", marital: "مجرد", employment: "شاغل", job: "فروشنده", phone: "09138888888", admissionDate: "1403/07/20", insurance: "دارد", attempts: "۱ بار", counselor: "خانم ابراهیمی", substance: "شیشه (مت‌آمفتامین)", substanceOther: "", startAge: 24, duration: 5, medHistory: ["افسردگی"], medicalNotes: "افسردگی شدید پس از قطع مصرف (کراش).", initialDrug: "بوپرنورفین", initialDosage: 1, currentDrug: "بوپرنورفین", currentDosage: 1, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-997", code: 997, fullName: "کامران تیموری", nationalId: "0188990011", birthdate: "1350/02/17", age: 55, gender: "مرد", marital: "متأهل", employment: "شاغل", job: "کارمند", phone: "09139999999", admissionDate: "1401/10/05", insurance: "دارد", attempts: "۲ تا ۵ بار", counselor: "آقای فتحی", substance: "تریاک", substanceOther: "", startAge: 30, duration: 25, medHistory: ["بیماری‌های ریوی"], medicalNotes: "مصرف سیگار بالا در کنار تریاک.", initialDrug: "اپیوم", initialDosage: 25, currentDrug: "اپیوم", currentDosage: 5, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-998", code: 998, fullName: "پرستو شمس", nationalId: "0199001122", birthdate: "1366/05/11", age: 39, gender: "زن", marital: "متأهل", employment: "شاغل", job: "معلم", phone: "09141111111", admissionDate: "1403/02/25", insurance: "دارد", attempts: "هیچ‌وقت ترک نکرده", counselor: "خانم ابراهیمی", substance: "هروئین", substanceOther: "", startAge: 32, duration: 7, medHistory: [], medicalNotes: "شروع مصرف به علت درد پس از جراحی.", initialDrug: "ش متادون", initialDosage: 30, currentDrug: "ش متادون", currentDosage: 15, status: "فعال", attendance: "منظم", deactiveReason: "", deactiveNotes: ""
    },
    {
        id: "P-999", code: 999, fullName: "بهزاد عباسی", nationalId: "0200112233", birthdate: "1370/09/22", age: 35, gender: "مرد", marital: "مطلقه - متارکه", employment: "بیکار", job: "", phone: "09142222222", admissionDate: "1402/12/10", insurance: "ندارد", attempts: "بیش از ۵ بار", counselor: "آقای فتحی", substance: "شیره", substanceOther: "", startAge: 20, duration: 15, medHistory: ["اختلال اضطرابی"], medicalNotes: "نیاز به مشاوره روانشناسی فشرده و اختلال شخصیت.", initialDrug: "ق متادون", initialDosage: 40, currentDrug: "ق متادون", currentDosage: 30, status: "غیرفعال", attendance: "غیبت", deactiveReason: "انتقال به مرکز دیگر", deactiveNotes: "انتقال پرونده به دلیل تغییر محل سکونت."
    }
];

const initialDummyVisits = [
    {
        id: "V-2001",
        patientId: "OMID-1004",
        date: "1405/02/10",
        notes: "همکاری خوب با دوز ۴۰ سی‌سی شربت متادون، بدون شکایت بالینی جدی.",
        prevDrug: "ش متادون",
        newDrug: "ش متادون",
        prevDosage: 40.0,
        newDosage: 40.0,
        status: "ادامه درمان",
        physician: "دکتر حسن‌پور",
        recordedBy: "دکتر حسن‌پور"
    },
    {
        id: "V-2002",
        patientId: "OMID-1002",
        date: "1405/02/15",
        notes: "افزایش دوز قرص ب۲ به علت هوس مصرف خفیف گزارش شده در هفته قبل.",
        prevDrug: "بوپرنورفین",
        newDrug: "بوپرنورفین",
        prevDosage: 2.0,
        newDosage: 3.0,
        status: "افزایش دوز",
        physician: "دکتر حسن‌پور",
        recordedBy: "دکتر حسن‌پور"
    },
    {
        id: "V-2003",
        patientId: "OMID-1001",
        date: "1405/03/01",
        notes: "کاهش دوز شربت اوپیوم به ۱۰ سی‌سی جهت آماده‌سازی ترخیص نهایی.",
        prevDrug: "اپیوم",
        newDrug: "اپیوم",
        prevDosage: 15.0,
        newDosage: 10.0,
        status: "کاهش دوز",
        physician: "دکتر حسن‌پور",
        recordedBy: "دکتر حسن‌پور"
    }
];

const initialDummyContactLogs = [
    {
        id: "C-3001",
        patientId: "OMID-1004",
        date: "1405/03/01",
        result: "فعال می‌باشد (در حال مراجعه / در راه)",
        notes: "بیمار قول داد فردا برای ویزیت حضور یابد.",
        nextAction: "عدم نیاز به پیگیری",
        recordedBy: "منشی کلینیک"
    }
];

const initialDummyInsuranceHistory = [
    {
        id: "I-4001",
        patientId: "OMID-1004",
        insuranceStatus: "دارد",
        date: "1405/01/01",
        recordedBy: "پذیرش"
    }
];

const initialDummyAuditLogs = [
    {
        id: "A-5001",
        patientId: "OMID-1004",
        fieldName: "شماره تماس",
        oldValue: "09120000000",
        newValue: "09123456789",
        date: "1405/01/10",
        time: "10:30",
        recordedBy: "دکتر حسن‌پور"
    }
];

const initialDummyBackupHistory = [
    {
        id: "B-6001",
        type: "export", // 'export' or 'import'
        date: "1405/03/10",
        time: "14:25",
        fileName: "nasim_rahayi_backup_1715421523.json",
        recordedBy: "سیستم (ایجاد اولیه)"
    }
];

// Default System Config Settings
const defaultSettings = {
    clinicName: "نسیم رهایی",
    displayTitle: "سامانه مدیریت کلینیک ترک اعتیاد «نسیم رهایی»",
    managerName: "دکتر حسن‌پور",
    chiefDoctorName: "دکتر حسن‌پور",
    city: "تهران",
    address: "خیابان آزادی، کوچه مریم، پلاک ۱۰",
    phone: "02166000000",
    mobile: "09120000000",
    description: "مرکز تخصصی درمان سوء مصرف مواد تحت نظارت وزارت بهداشت",
    autoSyncEnabled: false
};

const defaultStaff = {
    doctors: ["دکتر حسن‌پور"],
    psychologists: ["خانم ابراهیمی", "آقای فتحی"],
    archivedDoctors: [],
    archivedPsychologists: []
};

// لیست موارد نقص قابل بررسی در پرونده‌ها - برای افزودن مورد جدید در آینده، کافیست به این آرایه اضافه شود
const REVIEW_DEFICIENCY_OPTIONS = [
    "مدارک پرونده",
    "اوردر پزشک",
    "اوردر پرستار",
    "اوردر روانشناس",
    "ارزیابی‌های دوره‌ای روانشناس",
    "برگه آزمایش",
    "نتیجه آزمایش",
    "تاریخ تست ادراری"
];

// Global Chart Instances
let drugChart, ageChart, substanceChart, trendChart, genderChart, deactiveReasonChart;
