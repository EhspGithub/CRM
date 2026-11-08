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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import com.example.nasimrahayi.data.model.DispenseRecord
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.ui.components.DrugBadge
import com.example.nasimrahayi.ui.components.PersianDropdown
import com.example.nasimrahayi.ui.components.PersianInputField
import com.example.nasimrahayi.ui.theme.DarkSidebar
import com.example.nasimrahayi.ui.theme.StatusAmber
import com.example.nasimrahayi.ui.theme.StatusBlue
import com.example.nasimrahayi.ui.theme.StatusGreen
import com.example.nasimrahayi.ui.theme.StatusPurple
import com.example.nasimrahayi.ui.theme.TealBrand
import com.example.nasimrahayi.util.JalaliDateHelper

@Composable
fun DispenseScreen(
    dispenses: List<DispenseRecord>,
    patients: List<Patient>,
    shamsiToday: String,
    onAddDispense: (Patient, String, Double, Int, String) -> Unit,
    onDeleteDispense: (DispenseRecord) -> Unit,
    initialSelectedPatient: Patient? = null,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    var showAddDialog by remember { mutableStateOf(initialSelectedPatient != null) }
    var selectedPatient by remember { mutableStateOf(initialSelectedPatient ?: patients.firstOrNull()) }

    var selectedDrug by remember { mutableStateOf(selectedPatient?.currentDrug ?: "ش متادون") }
    var dosage by remember { mutableStateOf(selectedPatient?.currentDosage?.toString() ?: "40") }
    var days by remember { mutableStateOf("7") }
    var notes by remember { mutableStateOf("") }

    val filtered = remember(dispenses, searchQuery) {
        if (searchQuery.isBlank()) dispenses else {
            dispenses.filter {
                it.patientName.contains(searchQuery.trim(), ignoreCase = true) ||
                        it.drugName.contains(searchQuery.trim(), ignoreCase = true) ||
                        it.date.contains(searchQuery.trim())
            }
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF8FAFC))
        ) {
            // Header
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(16.dp)
            ) {
                Text(
                    text = "دفتر توزیع و ارائه دارو به مراجعین",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = DarkSidebar
                )
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("جستجو در تحویل دارو با نام بیمار، دارو یا تاریخ...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF64748B)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TealBrand,
                        unfocusedBorderColor = Color(0xFFE2E8F0),
                        focusedContainerColor = Color(0xFFF8FAFC),
                        unfocusedContainerColor = Color(0xFFF8FAFC)
                    )
                )
            }

            // Count
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "تعداد رکوردهای تحویل: ${JalaliDateHelper.formatNumber(filtered.size)} مورد",
                    fontSize = 12.sp,
                    color = Color(0xFF64748B),
                    fontWeight = FontWeight.Bold
                )
            }

            if (filtered.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "هیچ گزارشی از تحویل دارو ثبت نشده است",
                        color = Color(0xFF94A3B8),
                        fontSize = 14.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 80.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filtered, key = { it.id }) { record ->
                        DispenseCard(record = record, onDelete = { onDeleteDispense(record) })
                    }
                }
            }
        }

        // Floating Action Button
        FloatingActionButton(
            onClick = {
                if (selectedPatient == null && patients.isNotEmpty()) {
                    selectedPatient = patients.first()
                    selectedDrug = selectedPatient?.currentDrug ?: "ش متادون"
                    dosage = selectedPatient?.currentDosage?.toString() ?: "40"
                }
                showAddDialog = true
            },
            containerColor = TealBrand,
            contentColor = Color.White,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(20.dp)
                .testTag("fab_add_dispense")
        ) {
            Icon(imageVector = Icons.Default.Add, contentDescription = "Add Dispense")
        }

        // Add Dispense Dialog
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("ثبت تحویل داروی مراجع", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        val patientNames = patients.map { "${it.fullName} (کد ${it.code})" }
                        val currentName = selectedPatient?.let { "${it.fullName} (کد ${it.code})" } ?: ""

                        PersianDropdown(
                            selectedItem = currentName,
                            items = patientNames,
                            label = "انتخاب بیمار",
                            onItemSelected = { selectedStr ->
                                val found = patients.find { "${it.fullName} (کد ${it.code})" == selectedStr }
                                if (found != null) {
                                    selectedPatient = found
                                    selectedDrug = found.currentDrug
                                    dosage = found.currentDosage.toString()
                                }
                            }
                        )

                        PersianDropdown(
                            selectedItem = selectedDrug,
                            items = listOf("ش متادون", "ق متادون", "بوپرنورفین", "اپیوم"),
                            label = "نوع داروی تحویلی",
                            onItemSelected = { selectedDrug = it }
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PersianInputField(
                                value = dosage,
                                onValueChange = { dosage = it },
                                label = "دوز روزانه",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                            PersianInputField(
                                value = days,
                                onValueChange = { days = it },
                                label = "تعداد روز سهمیه",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        val dVal = dosage.toDoubleOrNull() ?: 0.0
                        val dayVal = days.toIntOrNull() ?: 0
                        val total = dVal * dayVal

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFCCFBF1))
                                .padding(10.dp)
                        ) {
                            Text(
                                text = "مجموع داروی تحویلی: ${JalaliDateHelper.formatNumber(total)} واحد (سی‌سی/قرص)",
                                color = TealBrand,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        PersianInputField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = "توضیحات و ملاحظات تحویل دارو"
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val p = selectedPatient
                            if (p != null) {
                                onAddDispense(
                                    p,
                                    selectedDrug,
                                    dosage.toDoubleOrNull() ?: p.currentDosage,
                                    days.toIntOrNull() ?: 7,
                                    notes
                                )
                                showAddDialog = false
                                notes = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TealBrand)
                    ) {
                        Text("ثبت تحویل", fontWeight = FontWeight.Bold)
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
fun DispenseCard(
    record: DispenseRecord,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
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
                        .background(Color(0xFFCCFBF1)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Medication,
                        contentDescription = null,
                        tint = TealBrand,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = record.patientName,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color(0xFF0F172A)
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0xFFF1F5F9))
                                .padding(horizontal = 5.dp, vertical = 1.dp)
                        ) {
                            Text(
                                text = "کد ${JalaliDateHelper.formatNumber(record.patientCode)}",
                                fontSize = 10.sp,
                                color = Color(0xFF64748B)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "${record.drugName} | روزانه: ${JalaliDateHelper.formatNumber(record.dosage)} | برای ${JalaliDateHelper.formatNumber(record.days)} روز",
                        fontSize = 12.sp,
                        color = Color(0xFF475569)
                    )

                    Text(
                        text = "مجموع: ${JalaliDateHelper.formatNumber(record.totalAmount)} واحد | تحویل‌دهنده: ${record.deliveredBy}",
                        fontSize = 11.sp,
                        color = TealBrand,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = JalaliDateHelper.toPersianDigits(record.date),
                    fontSize = 11.sp,
                    color = Color(0xFF94A3B8),
                    fontWeight = FontWeight.Bold
                )
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
