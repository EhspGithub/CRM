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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.example.nasimrahayi.data.model.OpiumDelivery
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.ui.components.PersianDropdown
import com.example.nasimrahayi.ui.components.PersianInputField
import com.example.nasimrahayi.ui.components.StatCard
import com.example.nasimrahayi.ui.components.StatusBadge
import com.example.nasimrahayi.ui.theme.DarkSidebar
import com.example.nasimrahayi.ui.theme.StatusAmber
import com.example.nasimrahayi.ui.theme.StatusGreen
import com.example.nasimrahayi.ui.theme.StatusRed
import com.example.nasimrahayi.ui.theme.TealBrand
import com.example.nasimrahayi.util.JalaliDateHelper

@Composable
fun OpiumScreen(
    deliveries: List<OpiumDelivery>,
    patients: List<Patient>,
    shamsiToday: String,
    onAddDelivery: (Patient, Double, String) -> Unit,
    onToggleVoid: (OpiumDelivery) -> Unit,
    onDeleteDelivery: (OpiumDelivery) -> Unit,
    initialPatient: Patient? = null,
    modifier: Modifier = Modifier
) {
    val opiumPatients = patients.filter { it.currentDrug.contains("اپیوم") }
    val validDeliveries = deliveries.filter { it.status == "معتبر" }
    val totalVolumeCc = validDeliveries.sumOf { it.amountCc }
    val totalBottles = totalVolumeCc / 250.0

    var showAddDialog by remember { mutableStateOf(initialPatient != null) }
    var selectedPatient by remember { mutableStateOf(initialPatient ?: opiumPatients.firstOrNull() ?: patients.firstOrNull()) }
    var amountCc by remember { mutableStateOf("250") }
    var notes by remember { mutableStateOf("") }

    Box(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF8FAFC)),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header Title
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFFFEF3C7)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocalDrink,
                                contentDescription = null,
                                tint = StatusAmber,
                                modifier = Modifier.size(26.dp)
                            )
                        }

                        Column {
                            Text(
                                text = "مدیریت و پروتکل شربت اپیوم (تنتور تریاک)",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = Color(0xFF92400E)
                            )
                            Text(
                                text = "پایش سهمیه‌ها بر مبنای بطری‌های استاندارد ۲۵۰ سی‌سی و اولویت‌های بالینی",
                                fontSize = 11.sp,
                                color = Color(0xFFB45309)
                            )
                        }
                    }
                }
            }

            // Stat Cards
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    StatCard(
                        title = "بیماران پروتکل اپیوم",
                        count = JalaliDateHelper.formatNumber(opiumPatients.size),
                        subtitle = "مراجعین تحت درمان اپیوم",
                        icon = Icons.Default.People,
                        iconTint = StatusAmber,
                        iconBg = Color(0xFFFEF3C7),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "کل شربت توزیع شده",
                        count = "${JalaliDateHelper.formatNumber(totalVolumeCc.toInt())} cc",
                        subtitle = "${JalaliDateHelper.formatNumber(totalBottles)} شیشه ۲۵۰cc",
                        icon = Icons.Default.Medication,
                        iconTint = TealBrand,
                        iconBg = Color(0xFFCCFBF1),
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Deliveries List Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "سوابق تحویل شربت اپیوم (${JalaliDateHelper.formatNumber(deliveries.size)})",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = Color(0xFF0F172A)
                    )
                }
            }

            if (deliveries.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "هنوز تحویلی در سیستم ثبت نشده است.",
                            color = Color(0xFF94A3B8),
                            fontSize = 13.sp
                        )
                    }
                }
            } else {
                items(deliveries, key = { it.id }) { del ->
                    OpiumDeliveryCard(
                        delivery = del,
                        onToggleVoid = { onToggleVoid(del) },
                        onDelete = { onDeleteDelivery(del) }
                    )
                }
            }
        }

        // Floating Action Button
        FloatingActionButton(
            onClick = {
                if (selectedPatient == null && (opiumPatients.isNotEmpty() || patients.isNotEmpty())) {
                    selectedPatient = opiumPatients.firstOrNull() ?: patients.first()
                }
                showAddDialog = true
            },
            containerColor = StatusAmber,
            contentColor = Color.White,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(20.dp)
                .testTag("fab_add_opium_delivery")
        ) {
            Icon(imageVector = Icons.Default.Add, contentDescription = "Add Opium Delivery")
        }

        // Add Delivery Dialog
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("ثبت تحویل شربت اپیوم", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        val patientChoices = patients.map { "${it.fullName} (کد ${it.code})" }
                        val currentName = selectedPatient?.let { "${it.fullName} (کد ${it.code})" } ?: ""

                        PersianDropdown(
                            selectedItem = currentName,
                            items = patientChoices,
                            label = "انتخاب بیمار",
                            onItemSelected = { selectedStr ->
                                val found = patients.find { "${it.fullName} (کد ${it.code})" == selectedStr }
                                if (found != null) {
                                    selectedPatient = found
                                }
                            }
                        )

                        PersianInputField(
                            value = amountCc,
                            onValueChange = { amountCc = it },
                            label = "حجم شربت (سی‌سی)",
                            isNumber = true
                        )

                        val cc = amountCc.toDoubleOrNull() ?: 0.0
                        val bottles = cc / 250.0

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFFEF3C7))
                                .padding(10.dp)
                        ) {
                            Text(
                                text = "معادل: ${JalaliDateHelper.formatNumber(bottles)} شیشه استاندارد ۲۵۰cc",
                                color = Color(0xFFB45309),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        PersianInputField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = "یادداشت و شماره پلمپ شیشه",
                            placeholder = "مثال: تحویل شیشه پلمپ شده دوره ۲۱ روزه"
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val p = selectedPatient
                            if (p != null) {
                                onAddDelivery(
                                    p,
                                    amountCc.toDoubleOrNull() ?: 250.0,
                                    notes
                                )
                                showAddDialog = false
                                notes = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = StatusAmber)
                    ) {
                        Text("ثبت تحویل اپیوم", fontWeight = FontWeight.Bold, color = Color.White)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) {
                        Text("انصراف")
                    }
                }
            )
        }
    }
}

@Composable
fun OpiumDeliveryCard(
    delivery: OpiumDelivery,
    onToggleVoid: () -> Unit,
    onDelete: () -> Unit
) {
    val isVoid = delivery.status == "ابطال‌شده"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isVoid) Color(0xFFF8FAFC) else Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isVoid) 0.dp else 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isVoid) Color(0xFFE2E8F0) else Color(0xFFFEF3C7)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.LocalDrink,
                        contentDescription = null,
                        tint = if (isVoid) Color(0xFF94A3B8) else StatusAmber,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = delivery.patientName,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = if (isVoid) Color(0xFF94A3B8) else Color(0xFF0F172A)
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(if (isVoid) Color(0xFFFEE2E2) else Color(0xFFDCFCE7))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = delivery.status,
                                fontSize = 10.sp,
                                color = if (isVoid) StatusRed else StatusGreen,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "مقدار: ${JalaliDateHelper.formatNumber(delivery.amountCc.toInt())} سی‌سی (${JalaliDateHelper.formatNumber(delivery.bottles)} شیشه)",
                        fontSize = 12.sp,
                        color = if (isVoid) Color(0xFF94A3B8) else Color(0xFF334155),
                        fontWeight = FontWeight.Medium
                    )

                    if (delivery.notes.isNotEmpty()) {
                        Text(
                            text = delivery.notes,
                            fontSize = 11.sp,
                            color = Color(0xFF94A3B8)
                        )
                    }
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = JalaliDateHelper.toPersianDigits(delivery.date),
                    fontSize = 11.sp,
                    color = Color(0xFF94A3B8),
                    fontWeight = FontWeight.Bold
                )

                Row {
                    IconButton(onClick = onToggleVoid) {
                        Icon(
                            imageVector = if (isVoid) Icons.Default.CheckCircle else Icons.Default.Block,
                            contentDescription = "Void",
                            tint = if (isVoid) StatusGreen else StatusAmber,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    IconButton(onClick = onDelete) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Delete",
                            tint = Color(0xFF94A3B8),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}
