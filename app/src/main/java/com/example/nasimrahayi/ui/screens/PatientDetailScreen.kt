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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import com.example.nasimrahayi.data.model.OpiumDelivery
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.data.model.Visit
import com.example.nasimrahayi.ui.components.DrugBadge
import com.example.nasimrahayi.ui.components.StatusBadge
import com.example.nasimrahayi.ui.navigation.Screen
import com.example.nasimrahayi.ui.theme.DarkSidebar
import com.example.nasimrahayi.ui.theme.StatusAmber
import com.example.nasimrahayi.ui.theme.StatusBlue
import com.example.nasimrahayi.ui.theme.StatusGreen
import com.example.nasimrahayi.ui.theme.TealBrand
import com.example.nasimrahayi.util.JalaliDateHelper

@Composable
fun PatientDetailScreen(
    patient: Patient?,
    visits: List<Visit>,
    dispenses: List<DispenseRecord>,
    opiumDeliveries: List<OpiumDelivery>,
    onBack: () -> Unit,
    onEdit: (String) -> Unit,
    onAddVisit: (Patient) -> Unit,
    onDispense: (Patient) -> Unit,
    modifier: Modifier = Modifier
) {
    if (patient == null) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("پرونده مورد نظر یافت نشد")
        }
        return
    }

    val patientVisits = visits.filter { it.patientId == patient.id }
    val patientDispenses = dispenses.filter { it.patientId == patient.id }
    val patientOpium = opiumDeliveries.filter { it.patientId == patient.id }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
    ) {
        // Top Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = DarkSidebar
                    )
                }
                Text(
                    text = "پرونده بالینی: ${patient.fullName}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = DarkSidebar
                )
            }

            IconButton(onClick = { onEdit(patient.id) }) {
                Icon(imageVector = Icons.Default.Edit, contentDescription = "Edit", tint = TealBrand)
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Patient Header Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFFCCFBF1)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Person,
                                        contentDescription = null,
                                        tint = TealBrand,
                                        modifier = Modifier.size(26.dp)
                                    )
                                }
                                Column {
                                    Text(
                                        text = patient.fullName,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0F172A)
                                    )
                                    Text(
                                        text = "کد پرونده: ${JalaliDateHelper.formatNumber(patient.code)} | تاریخ پذیرش: ${JalaliDateHelper.toPersianDigits(patient.admissionDate)}",
                                        fontSize = 11.sp,
                                        color = Color(0xFF64748B)
                                    )
                                }
                            }

                            StatusBadge(status = patient.status)
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Quick demographic grid
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            InfoItem("کد ملی", JalaliDateHelper.toPersianDigits(patient.nationalId))
                            InfoItem("سن / تولد", "${JalaliDateHelper.formatNumber(patient.age)} سال (${JalaliDateHelper.toPersianDigits(patient.birthdate)})")
                            InfoItem("تأهل", patient.marital)
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            InfoItem("شماره تماس", JalaliDateHelper.toPersianDigits(patient.phone))
                            InfoItem("شغل", if (patient.job.isNotEmpty()) patient.job else patient.employment)
                            InfoItem("پوشش بیمه", patient.insurance)
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            InfoItem("روانشناس / مشاور", patient.counselor)
                            InfoItem("سابقه کمپ", patient.campHistory)
                            InfoItem("نظم حضور", patient.attendance)
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Action Buttons Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = { onAddVisit(patient) },
                                colors = ButtonDefaults.buttonColors(containerColor = TealBrand),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.EventNote, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.size(6.dp))
                                Text("ثبت ویزیت جدید", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }

                            OutlinedButton(
                                onClick = { onDispense(patient) },
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.Medication, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.size(6.dp))
                                Text("ارائه دارو", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Clinical & Treatment Plan Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "طرح درمان و وضعیت دارویی",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color(0xFF0F172A)
                        )
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("داروی شروع درمان:", fontSize = 11.sp, color = Color(0xFF64748B))
                                DrugBadge(drugName = patient.initialDrug, dosage = patient.initialDosage)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("داروی فعلی مراجع:", fontSize = 11.sp, color = Color(0xFF64748B))
                                DrugBadge(drugName = patient.currentDrug, dosage = patient.currentDosage)
                            }
                        }

                        if (patient.currentPriority.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text("اولویت تحویل اپیوم:", fontSize = 12.sp, color = Color(0xFF64748B))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(Color(0xFFFEF3C7))
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = patient.currentPriority,
                                        color = StatusAmber,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "سابقه سوء مصرف: ${patient.substance} | سن شروع: ${JalaliDateHelper.formatNumber(patient.startAge)} سال | سابقه: ${JalaliDateHelper.formatNumber(patient.duration)} سال | دفعات ترک: ${patient.attempts}",
                            fontSize = 12.sp,
                            color = Color(0xFF475569)
                        )

                        if (patient.medHistory.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "سوابق پزشکی: ${patient.medHistory}",
                                fontSize = 12.sp,
                                color = StatusBlue,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        if (patient.medicalNotes.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "ملاحظات پزشک: ${patient.medicalNotes}",
                                fontSize = 12.sp,
                                color = Color(0xFF334155)
                            )
                        }
                    }
                }
            }

            // Visits History Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "تاریخچه ویزیت‌های پزشک (${JalaliDateHelper.formatNumber(patientVisits.size)})",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = Color(0xFF0F172A)
                    )
                }
            }

            if (patientVisits.isEmpty()) {
                item {
                    Text(
                        text = "هیچ ویزیتی برای این بیمار ثبت نشده است.",
                        fontSize = 12.sp,
                        color = Color(0xFF94A3B8)
                    )
                }
            } else {
                items(patientVisits) { visit ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "تاریخ: ${JalaliDateHelper.toPersianDigits(visit.date)}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TealBrand
                                )
                                StatusBadge(status = visit.status)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "دستور پزشک: ${visit.newDrug} (${JalaliDateHelper.formatNumber(visit.newDosage)}) | پزشک: ${visit.physician}",
                                fontSize = 12.sp,
                                color = Color(0xFF334155),
                                fontWeight = FontWeight.Medium
                            )
                            if (visit.notes.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "شرح: ${visit.notes}",
                                    fontSize = 11.sp,
                                    color = Color(0xFF64748B)
                                )
                            }
                        }
                    }
                }
            }

            // Dispense History Header
            item {
                Text(
                    text = "تاریخچه تحویل دارو (${JalaliDateHelper.formatNumber(patientDispenses.size)})",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = Color(0xFF0F172A)
                )
            }

            if (patientDispenses.isEmpty()) {
                item {
                    Text(
                        text = "هیچ گزارش تحویل دارویی ثبت نشده است.",
                        fontSize = 12.sp,
                        color = Color(0xFF94A3B8)
                    )
                }
            } else {
                items(patientDispenses) { dispense ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "${dispense.drugName} - مقدار کل: ${JalaliDateHelper.formatNumber(dispense.totalAmount)}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0F172A)
                                )
                                Text(
                                    text = "دوز روزانه: ${JalaliDateHelper.formatNumber(dispense.dosage)} برای ${JalaliDateHelper.formatNumber(dispense.days)} روز",
                                    fontSize = 11.sp,
                                    color = Color(0xFF64748B)
                                )
                            }
                            Text(
                                text = JalaliDateHelper.toPersianDigits(dispense.date),
                                fontSize = 11.sp,
                                color = Color(0xFF94A3B8),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoItem(label: String, value: String) {
    Column {
        Text(text = label, fontSize = 10.sp, color = Color(0xFF94A3B8))
        Text(
            text = value.ifEmpty { "—" },
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = Color(0xFF334155)
        )
    }
}
