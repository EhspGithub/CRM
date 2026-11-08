package com.example.nasimrahayi.ui.navigation

sealed class Screen(val title: String) {
    object Dashboard : Screen("داشبورد")
    object Patients : Screen("مدیریت پرونده‌ها")
    data class PatientDetail(val patientId: String) : Screen("پرونده بیمار")
    data class EditPatient(val patientId: String?) : Screen(if (patientId == null) "پذیرش بیمار جدید" else "ویرایش پرونده")
    object Visits : Screen("ویزیت و پیگیری")
    object Dispense : Screen("ارائه دارو")
    object Opium : Screen("مدیریت اپیوم")
    object Reports : Screen("گزارش‌گیری و آمار")
    object Settings : Screen("تنظیمات کلینیک")
}
