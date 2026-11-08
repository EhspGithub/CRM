package com.example.nasimrahayi.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.data.model.Visit
import com.example.nasimrahayi.ui.components.DrugBadge
import com.example.nasimrahayi.ui.components.PersianDropdown
import com.example.nasimrahayi.ui.components.PersianInputField
import com.example.nasimrahayi.ui.components.StatusBadge
import com.example.nasimrahayi.ui.theme.DarkSidebar
import com.example.nasimrahayi.ui.theme.StatusRed
import com.example.nasimrahayi.ui.theme.TealBrand
import com.example.nasimrahayi.util.JalaliDateHelper

@Composable
fun VisitsScreen(
    visits: List<Visit>,
    patients: List<Patient>,
    shamsiToday: String,
    onAddVisit: (Patient, String, Double, String, String, String) -> Unit,
    onDeleteVisit: (Visit) -> Unit,
    initialSelectedPatient: Patient? = null,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    var showAddDialog by remember { mutableStateOf(initialSelectedPatient != null) }
    var selectedPatient by remember { mutableStateOf(initialSelectedPatient ?: patients.firstOrNull()) }

    var newDrug by remember { mutableStateOf(selectedPatient?.currentDrug ?: "ش متادون") }
    var newDosage by remember { mutableStateOf(selectedPatient?.currentDosage?.toString() ?: "40") }
    var visitStatus by remember { mutableStateOf("ادامه درمان") }
    var notes by remember { mutableStateOf("") }
    var nextVisitDate by remember { mutableStateOf("") }

    val filteredVisits = remember(visits, searchQuery) {
        if (searchQuery.isBlank()) visits else {
            visits.filter {
                it.patientName.contains(searchQuery.trim(), ignoreCase = true) ||
                        it.notes.contains(searchQuery.trim(), ignoreCase = true) ||
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
            // Search Bar & Header
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(16.dp)
            ) {
                Text(
                    text = "ثبت و مدیریت ویزیت‌های پزشک",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = DarkSidebar
                )
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("جستجو در ویزیت‌ها با نام بیمار، یادداشت یا تاریخ...") },
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

            // Visits Count
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "کل ویزیت‌ها: ${JalaliDateHelper.formatNumber(filteredVisits.size)} جلسه",
                    fontSize = 12.sp,
                    color = Color(0xFF64748B),
                    fontWeight = FontWeight.Bold
                )
            }

            if (filteredVisits.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "هیچ ویزیتی ثبت نشده است",
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
                    items(filteredVisits, key = { it.id }) { visit ->
                        VisitCard(visit = visit, onDelete = { onDeleteVisit(visit) })
                    }
                }
            }
        }

        // Floating Action Button
        FloatingActionButton(
            onClick = {
                if (selectedPatient == null && patients.isNotEmpty()) {
                    selectedPatient = patients.first()
                    newDrug = selectedPatient?.currentDrug ?: "ش متادون"
                    newDosage = selectedPatient?.currentDosage?.toString() ?: "40"
                }
                showAddDialog = true
            },
            containerColor = TealBrand,
            contentColor = Color.White,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(20.dp)
                .testTag("fab_add_visit")
        ) {
            Icon(imageVector = Icons.Default.Add, contentDescription = "Add Visit")
        }

        // Add Visit Dialog
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("ثبت ویزیت جدید مراجع", fontWeight = FontWeight.Bold) },
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
                                    newDrug = found.currentDrug
                                    newDosage = found.currentDosage.toString()
                                }
                            }
                        )

                        PersianDropdown(
                            selectedItem = visitStatus,
                            items = listOf("ادامه درمان", "کاهش دوز", "افزایش دوز", "قطع دارو و پاکی", "ارجاع به روانپزشک"),
                            label = "وضعیت روند درمان",
                            onItemSelected = { visitStatus = it }
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PersianDropdown(
                                selectedItem = newDrug,
                                items = listOf("ش متادون", "ق متادون", "بوپرنورفین", "اپیوم", "روان درمانی"),
                                label = "داروی تجویزی",
                                onItemSelected = { newDrug = it },
                                modifier = Modifier.weight(1f)
                            )
                            PersianInputField(
                                value = newDosage,
                                onValueChange = { newDosage = it },
                                label = "دوز تجویزی",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        PersianInputField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = "شرح بالینی و دستورات پزشک",
                            maxLines = 2
                        )

                        PersianInputField(
                            value = nextVisitDate,
                            onValueChange = { nextVisitDate = it },
                            label = "تاریخ مراجعه بعدی (اختیاری)",
                            placeholder = "مثال: 1404/09/01"
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val p = selectedPatient
                            if (p != null) {
                                onAddVisit(
                                    p,
                                    newDrug,
                                    newDosage.toDoubleOrNull() ?: p.currentDosage,
                                    visitStatus,
                                    notes,
                                    nextVisitDate
                                )
                                showAddDialog = false
                                notes = ""
                                nextVisitDate = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TealBrand)
                    ) {
                        Text("ثبت ویزیت", fontWeight = FontWeight.Bold)
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
fun VisitCard(
    visit: Visit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
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
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFFEDE9FE)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.EventNote,
                            contentDescription = null,
                            tint = Color(0xFF8B5CF6),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Column {
                        Text(
                            text = visit.patientName,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = "تاریخ: ${JalaliDateHelper.toPersianDigits(visit.date)} | پزشک: ${visit.physician}",
                            fontSize = 11.sp,
                            color = Color(0xFF64748B)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusBadge(status = visit.status)
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

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "داروی تجویزی:", fontSize = 11.sp, color = Color(0xFF64748B))
                DrugBadge(drugName = visit.newDrug, dosage = visit.newDosage)
            }

            if (visit.notes.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "شرح: ${visit.notes}",
                    fontSize = 12.sp,
                    color = Color(0xFF334155)
                )
            }

            if (visit.nextVisitDate.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "مراجعه بعدی: ${JalaliDateHelper.toPersianDigits(visit.nextVisitDate)}",
                    fontSize = 11.sp,
                    color = TealBrand,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
