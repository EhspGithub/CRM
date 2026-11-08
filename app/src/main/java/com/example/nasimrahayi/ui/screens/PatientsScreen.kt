package com.example.nasimrahayi.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.FolderShared
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import com.example.nasimrahayi.ui.components.DrugBadge
import com.example.nasimrahayi.ui.components.PersianInputField
import com.example.nasimrahayi.ui.components.StatusBadge
import com.example.nasimrahayi.ui.navigation.Screen
import com.example.nasimrahayi.ui.theme.DarkSidebar
import com.example.nasimrahayi.ui.theme.StatusAmber
import com.example.nasimrahayi.ui.theme.StatusBlue
import com.example.nasimrahayi.ui.theme.StatusGreen
import com.example.nasimrahayi.ui.theme.StatusRed
import com.example.nasimrahayi.ui.theme.TealBrand
import com.example.nasimrahayi.util.JalaliDateHelper

@Composable
fun PatientsScreen(
    patients: List<Patient>,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    statusFilter: String,
    onStatusFilterChange: (String) -> Unit,
    drugFilter: String,
    onDrugFilterChange: (String) -> Unit,
    onNavigate: (Screen) -> Unit,
    onToggleStatus: (Patient) -> Unit,
    onDeletePatient: (Patient) -> Unit,
    onAddVisitClick: (Patient) -> Unit,
    onDispenseClick: (Patient) -> Unit,
    modifier: Modifier = Modifier
) {
    var patientToDelete by remember { mutableStateOf<Patient?>(null) }

    val filteredPatients = remember(patients, searchQuery, statusFilter, drugFilter) {
        patients.filter { patient ->
            val matchesQuery = if (searchQuery.isBlank()) true else {
                val cleanQ = searchQuery.trim()
                patient.fullName.contains(cleanQ, ignoreCase = true) ||
                        patient.nationalId.contains(cleanQ) ||
                        patient.phone.contains(cleanQ) ||
                        patient.code.toString().contains(cleanQ)
            }

            val matchesStatus = when (statusFilter) {
                "همه" -> true
                "فعال" -> patient.status == "فعال"
                "غیرفعال" -> patient.status == "غیرفعال"
                "منظم" -> patient.attendance == "منظم"
                "نامنظم" -> patient.attendance == "نامنظم"
                "غیبت" -> patient.attendance == "غیبت"
                else -> true
            }

            val matchesDrug = when (drugFilter) {
                "همه" -> true
                "ش متادون" -> patient.currentDrug.contains("ش متادون") || patient.currentDrug.contains("شربت متادون")
                "ق متادون" -> patient.currentDrug.contains("ق متادون") || patient.currentDrug.contains("قرص متادون")
                "بوپرنورفین" -> patient.currentDrug.contains("بوپرنورفین") || patient.currentDrug.contains("ب۲")
                "اپیوم" -> patient.currentDrug.contains("اپیوم")
                "روان‌درمانی" -> patient.currentDrug.contains("روان")
                else -> true
            }

            matchesQuery && matchesStatus && matchesDrug
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF8FAFC))
        ) {
            // Header Search & Filters
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                // Search Input
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("search_patients_input"),
                    shape = RoundedCornerShape(12.dp),
                    placeholder = { Text("جستجو با نام، کد ملی، شماره تماس یا کد پرونده...") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Search",
                            tint = Color(0xFF64748B)
                        )
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { onSearchChange("") }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear")
                            }
                        }
                    },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TealBrand,
                        unfocusedBorderColor = Color(0xFFE2E8F0),
                        focusedContainerColor = Color(0xFFF8FAFC),
                        unfocusedContainerColor = Color(0xFFF8FAFC)
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Status Filter Chips
                val statusOptions = listOf("همه", "فعال", "غیرفعال", "منظم", "نامنظم", "غیبت")
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    statusOptions.forEach { opt ->
                        val selected = statusFilter == opt
                        FilterChip(
                            selected = selected,
                            onClick = { onStatusFilterChange(opt) },
                            label = { Text(opt, fontSize = 11.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TealBrand,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Drug Filter Chips
                val drugOptions = listOf("همه", "ش متادون", "ق متادون", "بوپرنورفین", "اپیوم", "روان‌درمانی")
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    drugOptions.forEach { opt ->
                        val selected = drugFilter == opt
                        FilterChip(
                            selected = selected,
                            onClick = { onDrugFilterChange(opt) },
                            label = { Text(opt, fontSize = 11.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = DarkSidebar,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }
            }

            // Results count
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "نتایج: ${JalaliDateHelper.formatNumber(filteredPatients.size)} پرونده",
                    fontSize = 12.sp,
                    color = Color(0xFF64748B),
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "کل مراجعین: ${JalaliDateHelper.formatNumber(patients.size)}",
                    fontSize = 11.sp,
                    color = Color(0xFF94A3B8)
                )
            }

            // Patient Cards List
            if (filteredPatients.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "هیچ پرونده‌ای با این مشخصات یافت نشد",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF64748B)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "فیلترها را تغییر داده یا پرونده جدیدی ثبت کنید.",
                            fontSize = 12.sp,
                            color = Color(0xFF94A3B8)
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 80.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filteredPatients, key = { it.id }) { patient ->
                        PatientCard(
                            patient = patient,
                            onViewFile = { onNavigate(Screen.PatientDetail(patient.id)) },
                            onEdit = { onNavigate(Screen.EditPatient(patient.id)) },
                            onToggleStatus = { onToggleStatus(patient) },
                            onDelete = { patientToDelete = patient },
                            onAddVisit = { onAddVisitClick(patient) },
                            onDispense = { onDispenseClick(patient) }
                        )
                    }
                }
            }
        }

        // Floating Action Button to Add Patient
        FloatingActionButton(
            onClick = { onNavigate(Screen.EditPatient(null)) },
            containerColor = TealBrand,
            contentColor = Color.White,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(20.dp)
                .testTag("fab_add_patient")
        ) {
            Icon(imageVector = Icons.Default.Add, contentDescription = "Add Patient")
        }

        // Delete Confirmation Dialog
        patientToDelete?.let { p ->
            AlertDialog(
                onDismissRequest = { patientToDelete = null },
                title = { Text("حذف پرونده بالینی", fontWeight = FontWeight.Bold) },
                text = {
                    Text("آیا از حذف پرونده «${p.fullName}» (کد ${JalaliDateHelper.formatNumber(p.code)}) اطمینان دارید؟ تمامی سوابق این بیمار پاک خواهد شد.")
                },
                confirmButton = {
                    Button(
                        onClick = {
                            onDeletePatient(p)
                            patientToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = StatusRed)
                    ) {
                        Text("حذف پرونده", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { patientToDelete = null }) {
                        Text("انصراف")
                    }
                }
            )
        }
    }
}

@Composable
fun PatientCard(
    patient: Patient,
    onViewFile: () -> Unit,
    onEdit: () -> Unit,
    onToggleStatus: () -> Unit,
    onDelete: () -> Unit,
    onAddVisit: () -> Unit,
    onDispense: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Header Row: Code & Name & Badges
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
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF0F172A))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "کد ${JalaliDateHelper.formatNumber(patient.code)}",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Text(
                        text = patient.fullName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = Color(0xFF0F172A)
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    StatusBadge(status = patient.status)
                    StatusBadge(status = patient.attendance)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Patient Info Specs
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "کد ملی: ${JalaliDateHelper.toPersianDigits(patient.nationalId)}",
                        fontSize = 12.sp,
                        color = Color(0xFF64748B)
                    )
                    Text(
                        text = "تماس: ${JalaliDateHelper.toPersianDigits(patient.phone)}",
                        fontSize = 12.sp,
                        color = Color(0xFF64748B)
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "ماده: ${patient.substance}",
                        fontSize = 12.sp,
                        color = Color(0xFF64748B),
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "بیمه: ${patient.insurance}",
                        fontSize = 12.sp,
                        color = if (patient.insurance == "دارد") StatusGreen else Color(0xFF94A3B8),
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Drug Badge & Priority
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "داروی فعلی:",
                        fontSize = 11.sp,
                        color = Color(0xFF94A3B8),
                        fontWeight = FontWeight.Medium
                    )
                    DrugBadge(drugName = patient.currentDrug, dosage = patient.currentDosage)
                }

                if (patient.currentPriority.isNotEmpty()) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFFFEF3C7))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "اولویت: ${patient.currentPriority}",
                            color = StatusAmber,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Button(
                    onClick = onViewFile,
                    colors = ButtonDefaults.buttonColors(containerColor = TealBrand),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.FolderShared, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("پرونده کامل", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                OutlinedButton(
                    onClick = onAddVisit,
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.EventNote, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("ویزیت", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                OutlinedButton(
                    onClick = onDispense,
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Medication, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("دارو", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                IconButton(
                    onClick = onEdit,
                    modifier = Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFF1F5F9))
                ) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Color(0xFF475569), modifier = Modifier.size(16.dp))
                }

                IconButton(
                    onClick = onDelete,
                    modifier = Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFFEE2E2))
                ) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusRed, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}
