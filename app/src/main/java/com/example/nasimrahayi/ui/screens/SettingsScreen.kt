package com.example.nasimrahayi.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.nasimrahayi.data.model.ClinicSettings
import com.example.nasimrahayi.ui.components.PersianInputField
import com.example.nasimrahayi.ui.theme.DarkSidebar
import com.example.nasimrahayi.ui.theme.StatusAmber
import com.example.nasimrahayi.ui.theme.StatusGreen
import com.example.nasimrahayi.ui.theme.StatusRed
import com.example.nasimrahayi.ui.theme.TealBrand

@Composable
fun SettingsScreen(
    settings: ClinicSettings,
    onSaveSettings: (ClinicSettings) -> Unit,
    onResetToSampleData: () -> Unit,
    modifier: Modifier = Modifier
) {
    var clinicName by remember(settings) { mutableStateOf(settings.clinicName) }
    var managerName by remember(settings) { mutableStateOf(settings.managerName) }
    var chiefDoctorName by remember(settings) { mutableStateOf(settings.chiefDoctorName) }
    var phone by remember(settings) { mutableStateOf(settings.phone) }
    var mobile by remember(settings) { mutableStateOf(settings.mobile) }
    var address by remember(settings) { mutableStateOf(settings.address) }
    var lockPin by remember(settings) { mutableStateOf(settings.lockPin) }

    var showResetDialog by remember { mutableStateOf(false) }
    var savedSuccess by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC)),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(
                text = "تنظیمات سامانه کلینیک",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = DarkSidebar
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "مدیریت اطلاعات کلینیک، امنیت پرونده‌ها و بازنشانی داده‌ها",
                fontSize = 12.sp,
                color = Color(0xFF64748B)
            )
        }

        if (savedSuccess) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFDCFCE7))
                        .padding(12.dp)
                ) {
                    Text(
                        text = "تنظیمات با موفقیت ذخیره شد.",
                        color = StatusGreen,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Clinic Info Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "اطلاعات پایه کلینیک",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = TealBrand
                    )

                    PersianInputField(
                        value = clinicName,
                        onValueChange = { clinicName = it },
                        label = "نام کلینیک"
                    )

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PersianInputField(
                            value = managerName,
                            onValueChange = { managerName = it },
                            label = "مؤسس و مدیر مرکز",
                            modifier = Modifier.weight(1f)
                        )
                        PersianInputField(
                            value = chiefDoctorName,
                            onValueChange = { chiefDoctorName = it },
                            label = "پزشک ارشد درمانگر",
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PersianInputField(
                            value = phone,
                            onValueChange = { phone = it },
                            label = "تلفن ثابت کلینیک",
                            isNumber = true,
                            modifier = Modifier.weight(1f)
                        )
                        PersianInputField(
                            value = mobile,
                            onValueChange = { mobile = it },
                            label = "شماره همراه مدیریت",
                            isNumber = true,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    PersianInputField(
                        value = address,
                        onValueChange = { address = it },
                        label = "آدرس کلینیک",
                        maxLines = 2
                    )

                    Button(
                        onClick = {
                            val updated = settings.copy(
                                clinicName = clinicName.trim(),
                                managerName = managerName.trim(),
                                chiefDoctorName = chiefDoctorName.trim(),
                                phone = phone.trim(),
                                mobile = mobile.trim(),
                                address = address.trim(),
                                lockPin = lockPin.trim()
                            )
                            onSaveSettings(updated)
                            savedSuccess = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TealBrand),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("btn_save_settings")
                    ) {
                        Icon(imageVector = Icons.Default.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.size(6.dp))
                        Text("ذخیره تغییرات کلینیک", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Security & Pin Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Security, contentDescription = null, tint = StatusAmber)
                        Text(
                            text = "امنیت و قفل نرم‌افزار",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color(0xFF0F172A)
                        )
                    }

                    Text(
                        text = "جهت حفظ محرمانگی پرونده‌های بیماران، می‌توانید برای نرم‌افزار پین کد (رمز ۴ رقمی) تعیین کنید. در صورت خالی بودن، رمز پیش‌فرض 1234 فعال خواهد بود.",
                        fontSize = 12.sp,
                        color = Color(0xFF64748B)
                    )

                    PersianInputField(
                        value = lockPin,
                        onValueChange = { lockPin = it },
                        label = "رمز عبور قفل برنامه (PIN)",
                        placeholder = "1234",
                        isNumber = true
                    )
                }
            }
        }

        // Reset Data Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Storage, contentDescription = null, tint = DarkSidebar)
                        Text(
                            text = "مدیریت داده‌ها و بازنشانی",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color(0xFF0F172A)
                        )
                    }

                    Text(
                        text = "سامانه نسیم رهایی از دیتابیس لوکال SQLite (Room) روی همین دستگاه استفاده می‌کند و بدون اینترنت به طور کامل کار می‌کند.",
                        fontSize = 12.sp,
                        color = Color(0xFF64748B)
                    )

                    OutlinedButton(
                        onClick = { showResetDialog = true },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusRed),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("btn_reset_sample_data")
                    ) {
                        Icon(imageVector = Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.size(6.dp))
                        Text("بارگذاری مجدد داده‌های نمونه اولیه نسیم رهایی", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    if (showResetDialog) {
        AlertDialog(
            onDismissRequest = { showResetDialog = false },
            title = { Text("بازنشانی داده‌ها به نمونه اولیه", fontWeight = FontWeight.Bold) },
            text = {
                Text("آیا مطمئن هستید؟ تمامی داده‌ها با داده‌های دمو و نمونه اولیه کلینیک (۲۰ پرونده کامل به همراه ویزیت‌ها و توزیع دارو) جایگزین خواهند شد.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        onResetToSampleData()
                        showResetDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusRed)
                ) {
                    Text("بله، بازنشانی شود", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetDialog = false }) {
                    Text("انصراف")
                }
            }
        )
    }
}
