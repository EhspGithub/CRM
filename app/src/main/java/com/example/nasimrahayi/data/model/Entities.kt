package com.example.nasimrahayi.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "patients")
data class Patient(
    @PrimaryKey val id: String,
    val code: Int,
    val fullName: String,
    val nationalId: String,
    val birthdate: String = "",
    val age: Int = 0,
    val gender: String = "مرد",
    val marital: String = "متأهل",
    val employment: String = "شاغل",
    val job: String = "",
    val phone: String = "",
    val admissionDate: String = "",
    val insurance: String = "دارد", // دارد / ندارد
    val attempts: String = "هیچ‌وقت ترک نکرده",
    val counselor: String = "آقای فتحی",
    val substance: String = "تریاک",
    val substanceOther: String = "",
    val startAge: Int = 20,
    val duration: Int = 5,
    val medHistory: String = "", // Comma-separated
    val medicalNotes: String = "",
    val initialDrug: String = "ش متادون",
    val initialDosage: Double = 0.0,
    val currentDrug: String = "ش متادون",
    val currentDosage: Double = 0.0,
    val status: String = "فعال", // فعال / غیرفعال
    val attendance: String = "منظم", // منظم / نامنظم / غیبت
    val deactiveReason: String = "",
    val deactiveNotes: String = "",
    val campHistory: String = "ندارد",
    val currentPriority: String = "" // A1, A2, B1, B2, B3 or empty
)

@Entity(tableName = "visits")
data class Visit(
    @PrimaryKey val id: String,
    val patientId: String,
    val patientName: String = "",
    val date: String,
    val notes: String = "",
    val prevDrug: String = "",
    val newDrug: String = "",
    val prevDosage: Double = 0.0,
    val newDosage: Double = 0.0,
    val status: String = "ادامه درمان", // ادامه درمان / کاهش دوز / افزایش دوز / قطع دارو
    val physician: String = "دکتر حسن‌پور",
    val recordedBy: String = "دکتر حسن‌پور",
    val nextVisitDate: String = ""
)

@Entity(tableName = "dispense_records")
data class DispenseRecord(
    @PrimaryKey val id: String,
    val patientId: String,
    val patientName: String,
    val patientCode: Int,
    val date: String,
    val drugName: String,
    val dosage: Double, // Daily dosage
    val days: Int, // Number of days supply
    val totalAmount: Double = dosage * days,
    val deliveredBy: String = "پرسنل کلینیک",
    val notes: String = "",
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "opium_deliveries")
data class OpiumDelivery(
    @PrimaryKey val id: String,
    val patientId: String,
    val patientName: String,
    val date: String,
    val amountCc: Double,
    val bottles: Double = amountCc / 250.0,
    val weekday: String = "",
    val status: String = "معتبر", // معتبر / ابطال‌شده
    val notes: String = "",
    val recordedBy: String = "دکتر حسن‌پور",
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "clinic_settings")
data class ClinicSettings(
    @PrimaryKey val id: Int = 1,
    val clinicName: String = "نسیم رهایی",
    val displayTitle: String = "سامانه مدیریت کلینیک ترک اعتیاد «نسیم رهایی»",
    val managerName: String = "دکتر حسن‌پور",
    val chiefDoctorName: String = "دکتر حسن‌پور",
    val phone: String = "021-66000000",
    val mobile: String = "0912-3456789",
    val address: String = "تهران، خیابان آزادی، پلاک ۱۰",
    val lockPin: String = "",
    val isLocked: Boolean = false
)
