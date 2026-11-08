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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.nasimrahayi.data.model.DispenseRecord
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.data.model.Visit
import com.example.nasimrahayi.ui.theme.DarkSidebar
import com.example.nasimrahayi.ui.theme.StatusAmber
import com.example.nasimrahayi.ui.theme.StatusBlue
import com.example.nasimrahayi.ui.theme.StatusGreen
import com.example.nasimrahayi.ui.theme.StatusPurple
import com.example.nasimrahayi.ui.theme.StatusRed
import com.example.nasimrahayi.ui.theme.TealBrand
import com.example.nasimrahayi.util.JalaliDateHelper

@Composable
fun ReportsScreen(
    patients: List<Patient>,
    visits: List<Visit>,
    dispenses: List<DispenseRecord>,
    modifier: Modifier = Modifier
) {
    val totalPatients = patients.size
    val active = patients.count { it.status == "فعال" }
    val regular = patients.count { it.attendance == "منظم" }
    val irregular = patients.count { it.attendance == "نامنظم" }
    val absent = patients.count { it.attendance == "غیبت" }

    val males = patients.count { it.gender == "مرد" }
    val females = patients.count { it.gender == "زن" }

    val insured = patients.count { it.insurance == "دارد" }

    val ageUnder30 = patients.count { it.age < 30 }
    val age30to45 = patients.count { it.age in 30..45 }
    val age46to60 = patients.count { it.age in 46..60 }
    val ageOver60 = patients.count { it.age > 60 }

    val substances = patients.groupingBy { it.substance }.eachCount()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC)),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(
                text = "گزارش‌های تحلیلی و آماری کلینیک",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = DarkSidebar
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "نمودارها و توزیع جمعیت‌شناختی و درمانی مراجعین مرکز",
                fontSize = 12.sp,
                color = Color(0xFF64748B)
            )
        }

        // Attendance & Status Report
        item {
            ReportCard(title = "وضعیت حضور و پایبندی به درمان") {
                MetricBar(label = "مراجعه منظم", count = regular, total = totalPatients, color = StatusGreen)
                Spacer(modifier = Modifier.height(8.dp))
                MetricBar(label = "مراجعه نامنظم", count = irregular, total = totalPatients, color = StatusAmber)
                Spacer(modifier = Modifier.height(8.dp))
                MetricBar(label = "غیبت / نیازمند پیگیری", count = absent, total = totalPatients, color = StatusRed)
            }
        }

        // Substance Abuse Distribution
        item {
            ReportCard(title = "توزیع ماده مصرفی اولیه مراجعین") {
                substances.entries.sortedByDescending { it.value }.forEach { (substanceName, count) ->
                    MetricBar(label = substanceName, count = count, total = totalPatients, color = TealBrand)
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }

        // Age Group Distribution
        item {
            ReportCard(title = "رده‌های سنی مراجعین") {
                MetricBar(label = "زیر ۳۰ سال", count = ageUnder30, total = totalPatients, color = StatusBlue)
                Spacer(modifier = Modifier.height(8.dp))
                MetricBar(label = "۳۰ تا ۴۵ سال", count = age30to45, total = totalPatients, color = TealBrand)
                Spacer(modifier = Modifier.height(8.dp))
                MetricBar(label = "۴۶ تا ۶۰ سال", count = age46to60, total = totalPatients, color = StatusAmber)
                Spacer(modifier = Modifier.height(8.dp))
                MetricBar(label = "بالای ۶۰ سال", count = ageOver60, total = totalPatients, color = StatusPurple)
            }
        }

        // Gender & Insurance Report
        item {
            ReportCard(title = "پوشش بیمه و ترکیب جنسیتی") {
                MetricBar(label = "مردان", count = males, total = totalPatients, color = Color(0xFF0F766E))
                Spacer(modifier = Modifier.height(8.dp))
                MetricBar(label = "زنان", count = females, total = totalPatients, color = Color(0xFFDB2777))
                Spacer(modifier = Modifier.height(8.dp))
                MetricBar(label = "دارای پوشش بیمه ماهانه", count = insured, total = totalPatients, color = StatusGreen)
            }
        }
    }
}

@Composable
private fun ReportCard(
    title: String,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF0F172A)
            )
            Spacer(modifier = Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun MetricBar(
    label: String,
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
            Text(text = label, fontSize = 12.sp, color = Color(0xFF334155), fontWeight = FontWeight.Medium)
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
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = color,
            trackColor = Color(0xFFF1F5F9)
        )
    }
}
