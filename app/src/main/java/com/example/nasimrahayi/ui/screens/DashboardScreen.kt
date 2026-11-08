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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Healing
import androidx.compose.material.icons.filled.MedicalInformation
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.data.model.Visit
import com.example.nasimrahayi.ui.components.DrugBadge
import com.example.nasimrahayi.ui.components.StatCard
import com.example.nasimrahayi.ui.components.StatusBadge
import com.example.nasimrahayi.ui.navigation.Screen
import com.example.nasimrahayi.ui.theme.StatusAmber
import com.example.nasimrahayi.ui.theme.StatusBlue
import com.example.nasimrahayi.ui.theme.StatusGreen
import com.example.nasimrahayi.ui.theme.StatusPurple
import com.example.nasimrahayi.ui.theme.StatusRed
import com.example.nasimrahayi.ui.theme.TealBrand
import com.example.nasimrahayi.util.JalaliDateHelper

@Composable
fun DashboardScreen(
    patients: List<Patient>,
    visits: List<Visit>,
    onNavigate: (Screen) -> Unit,
    onDeletePatient: (Patient) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val totalCount = patients.size
    val activeCount = patients.count { it.status == "فعال" }
    val absentCount = patients.count { it.attendance == "غیبت" || it.status == "غیرفعال" }
    val insuredCount = patients.count { it.insurance == "دارد" }
    val opiumCount = patients.count { it.currentDrug.contains("اپیوم") }
    val visitsCount = visits.size

    val methadoneSyrupCount = patients.count { it.currentDrug.contains("ش متادون") || it.currentDrug.contains("شربت متادون") }
    val methadoneTabCount = patients.count { it.currentDrug.contains("ق متادون") || it.currentDrug.contains("قرص متادون") }
    val buprenorphineCount = patients.count { it.currentDrug.contains("بوپرنورفین") || it.currentDrug.contains("ب۲") }
    val therapyCount = patients.count { it.currentDrug.contains("روان") }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC)),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Welcome banner
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = TealBrand)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "داشبورد آماری و مدیریتی کلینیک",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "سامانه یکپارچه مراجعین، پرونده‌های بالینی، پروتکل اپیوم و ارائه دارو",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 12.sp
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { onNavigate(Screen.EditPatient(null)) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color.White,
                                contentColor = TealBrand
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .weight(1f)
                                .testTag("btn_quick_add_patient")
                        ) {
                            Icon(
                                imageVector = Icons.Default.PersonAdd,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.size(6.dp))
                            Text("پذیرش جدید", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = { onNavigate(Screen.Visits) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF111D2C),
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .weight(1f)
                                .testTag("btn_quick_visits")
                        ) {
                            Icon(
                                imageVector = Icons.Default.EventNote,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.size(6.dp))
                            Text("ثبت ویزیت", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Stat cards grid
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatCard(
                    title = "کل پرونده‌ها",
                    count = JalaliDateHelper.formatNumber(totalCount),
                    subtitle = "ثبت دیتابیس لوکال",
                    icon = Icons.Default.MedicalInformation,
                    iconTint = TealBrand,
                    iconBg = Color(0xFFCCFBF1),
                    modifier = Modifier.weight(1f),
                    onClick = { onNavigate(Screen.Patients) }
                )
                StatCard(
                    title = "پرونده‌های فعال",
                    count = JalaliDateHelper.formatNumber(activeCount),
                    subtitle = "درمان منظم و نامنظم",
                    icon = Icons.Default.Favorite,
                    iconTint = StatusGreen,
                    iconBg = Color(0xFFDCFCE7),
                    modifier = Modifier.weight(1f),
                    onClick = { onNavigate(Screen.Patients) }
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatCard(
                    title = "غایبین و پیگیری",
                    count = JalaliDateHelper.formatNumber(absentCount),
                    subtitle = "نیازمند تماس فوری",
                    icon = Icons.Default.Warning,
                    iconTint = StatusRed,
                    iconBg = Color(0xFFFEE2E2),
                    modifier = Modifier.weight(1f),
                    onClick = { onNavigate(Screen.Patients) }
                )
                StatCard(
                    title = "پروتکل اپیوم",
                    count = JalaliDateHelper.formatNumber(opiumCount),
                    subtitle = "شربت تریاک",
                    icon = Icons.Default.Medication,
                    iconTint = StatusAmber,
                    iconBg = Color(0xFFFEF3C7),
                    modifier = Modifier.weight(1f),
                    onClick = { onNavigate(Screen.Opium) }
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatCard(
                    title = "دارای بیمه فعال",
                    count = JalaliDateHelper.formatNumber(insuredCount),
                    subtitle = "پوشش بیمه‌ای",
                    icon = Icons.Default.Security,
                    iconTint = StatusBlue,
                    iconBg = Color(0xFFDBEAFE),
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    title = "ویزیت‌های ثبت شده",
                    count = JalaliDateHelper.formatNumber(visitsCount),
                    subtitle = "پرونده‌های معاینه شده",
                    icon = Icons.Default.AssignmentTurnedIn,
                    iconTint = StatusPurple,
                    iconBg = Color(0xFFEDE9FE),
                    modifier = Modifier.weight(1f),
                    onClick = { onNavigate(Screen.Visits) }
                )
            }
        }

        // Drug breakdown card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "تفکیک داروی مصرفی بیماران فعال",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = Color(0xFF0F172A)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    DrugProgressRow(
                        name = "شربت متادون",
                        count = methadoneSyrupCount,
                        total = totalCount,
                        color = TealBrand
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    DrugProgressRow(
                        name = "قرص متادون",
                        count = methadoneTabCount,
                        total = totalCount,
                        color = StatusPurple
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    DrugProgressRow(
                        name = "بوپرنورفین (ب۲)",
                        count = buprenorphineCount,
                        total = totalCount,
                        color = StatusBlue
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    DrugProgressRow(
                        name = "تنتور اپیوم (شربت تریاک)",
                        count = opiumCount,
                        total = totalCount,
                        color = StatusAmber
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    DrugProgressRow(
                        name = "روان‌درمانی و بدون دارو",
                        count = therapyCount,
                        total = totalCount,
                        color = Color(0xFF64748B)
                    )
                }
            }
        }

        // Clinical Cases Summary with Swipe-to-Delete
        item {
            PatientDashboard(
                patients = patients,
                onDeletePatient = onDeletePatient,
                onPatientClick = { patient ->
                    onNavigate(Screen.PatientDetail(patient.id))
                }
            )
        }

        // Recent Visits section
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "آخرین ویزیت‌های ثبت شده",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = Color(0xFF0F172A)
                )
                OutlinedButton(
                    onClick = { onNavigate(Screen.Visits) },
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("مشاهده همه", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (visits.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "هنوز ویزیتی ثبت نشده است",
                        color = Color(0xFF94A3B8),
                        fontSize = 12.sp
                    )
                }
            }
        } else {
            items(visits.take(3)) { visit ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = visit.patientName,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = Color(0xFF0F172A)
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "دستور: ${visit.newDrug} (${JalaliDateHelper.formatNumber(visit.newDosage)})",
                                fontSize = 11.sp,
                                color = Color(0xFF64748B)
                            )
                            if (visit.notes.isNotEmpty()) {
                                Text(
                                    text = visit.notes,
                                    fontSize = 11.sp,
                                    color = Color(0xFF94A3B8),
                                    maxLines = 1
                                )
                            }
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = JalaliDateHelper.toPersianDigits(visit.date),
                                fontSize = 11.sp,
                                color = TealBrand,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            StatusBadge(status = visit.status)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DrugProgressRow(
    name: String,
    count: Int,
    total: Int,
    color: Color
) {
    val progress = if (total > 0) count.toFloat() / total.toFloat() else 0f
    val percent = (progress * 100).toInt()

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(text = name, fontSize = 12.sp, color = Color(0xFF334155), fontWeight = FontWeight.Medium)
            Text(
                text = "${JalaliDateHelper.formatNumber(count)} نفر (${JalaliDateHelper.formatNumber(percent)}٪)",
                fontSize = 11.sp,
                color = Color(0xFF64748B),
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = color,
            trackColor = Color(0xFFF1F5F9)
        )
    }
}
