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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import com.example.nasimrahayi.ui.components.PersianDropdown
import com.example.nasimrahayi.ui.components.PersianInputField
import com.example.nasimrahayi.ui.theme.DarkSidebar
import com.example.nasimrahayi.ui.theme.StatusRed
import com.example.nasimrahayi.ui.theme.TealBrand
import com.example.nasimrahayi.util.JalaliDateHelper
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun AddEditPatientScreen(
    existingPatient: Patient?,
    shamsiToday: String,
    onGetNextCode: suspend () -> Int,
    onSave: (Patient) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    var code by remember { mutableStateOf(existingPatient?.code?.toString() ?: "") }
    var fullName by remember { mutableStateOf(existingPatient?.fullName ?: "") }
    var nationalId by remember { mutableStateOf(existingPatient?.nationalId ?: "") }
    var phone by remember { mutableStateOf(existingPatient?.phone ?: "") }
    var birthdate by remember { mutableStateOf(existingPatient?.birthdate ?: "1365/01/01") }
    var age by remember { mutableStateOf(existingPatient?.age?.toString() ?: "38") }
    var gender by remember { mutableStateOf(existingPatient?.gender ?: "مرد") }
    var marital by remember { mutableStateOf(existingPatient?.marital ?: "متأهل") }
    var employment by remember { mutableStateOf(existingPatient?.employment ?: "شاغل") }
    var job by remember { mutableStateOf(existingPatient?.job ?: "") }
    var admissionDate by remember { mutableStateOf(existingPatient?.admissionDate ?: shamsiToday) }
    var insurance by remember { mutableStateOf(existingPatient?.insurance ?: "دارد") }
    var counselor by remember { mutableStateOf(existingPatient?.counselor ?: "آقای فتحی") }
    var substance by remember { mutableStateOf(existingPatient?.substance ?: "تریاک") }
    var startAge by remember { mutableStateOf(existingPatient?.startAge?.toString() ?: "22") }
    var duration by remember { mutableStateOf(existingPatient?.duration?.toString() ?: "8") }
    var attempts by remember { mutableStateOf(existingPatient?.attempts ?: "۲ تا ۵ بار") }
    var campHistory by remember { mutableStateOf(existingPatient?.campHistory ?: "ندارد") }

    val diseases = listOf(
        "دیابت", "فشار خون", "بیماری کبدی", "بیماری کلیوی",
        "بیماری ایسکمیک قلب", "هپاتیت C", "افسردگی", "اختلال خواب", "اختلال اضطرابی"
    )
    val selectedDiseases = remember {
        mutableStateListOf<String>().apply {
            if (existingPatient != null && existingPatient.medHistory.isNotEmpty()) {
                addAll(existingPatient.medHistory.split("،", ",").map { it.trim() })
            }
        }
    }

    var medicalNotes by remember { mutableStateOf(existingPatient?.medicalNotes ?: "") }
    var initialDrug by remember { mutableStateOf(existingPatient?.initialDrug ?: "ش متادون") }
    var initialDosage by remember { mutableStateOf(existingPatient?.initialDosage?.toString() ?: "40") }
    var currentDrug by remember { mutableStateOf(existingPatient?.currentDrug ?: "ش متادون") }
    var currentDosage by remember { mutableStateOf(existingPatient?.currentDosage?.toString() ?: "40") }
    var currentPriority by remember { mutableStateOf(existingPatient?.currentPriority ?: "بدون اولویت") }
    var status by remember { mutableStateOf(existingPatient?.status ?: "فعال") }
    var attendance by remember { mutableStateOf(existingPatient?.attendance ?: "منظم") }

    var errorMessage by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        if (existingPatient == null && code.isEmpty()) {
            code = onGetNextCode().toString()
        }
    }

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
                IconButton(onClick = onCancel) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = DarkSidebar
                    )
                }
                Text(
                    text = if (existingPatient == null) "پذیرش بیمار جدید" else "ویرایش پرونده",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = DarkSidebar
                )
            }

            Button(
                onClick = {
                    if (fullName.isBlank()) {
                        errorMessage = "لطفاً نام و نام خانوادگی بیمار را وارد کنید."
                        return@Button
                    }
                    if (nationalId.length < 8) {
                        errorMessage = "لطفاً کد ملی معتبر وارد کنید."
                        return@Button
                    }

                    val patient = Patient(
                        id = existingPatient?.id ?: "P-${System.currentTimeMillis() % 100000}",
                        code = code.toIntOrNull() ?: 1000,
                        fullName = fullName.trim(),
                        nationalId = nationalId.trim(),
                        birthdate = birthdate.trim(),
                        age = age.toIntOrNull() ?: 0,
                        gender = gender,
                        marital = marital,
                        employment = employment,
                        job = job.trim(),
                        phone = phone.trim(),
                        admissionDate = admissionDate,
                        insurance = insurance,
                        attempts = attempts,
                        counselor = counselor,
                        substance = substance,
                        startAge = startAge.toIntOrNull() ?: 20,
                        duration = duration.toIntOrNull() ?: 0,
                        medHistory = selectedDiseases.joinToString("، "),
                        medicalNotes = medicalNotes.trim(),
                        initialDrug = initialDrug,
                        initialDosage = initialDosage.toDoubleOrNull() ?: 0.0,
                        currentDrug = currentDrug,
                        currentDosage = currentDosage.toDoubleOrNull() ?: 0.0,
                        status = status,
                        attendance = attendance,
                        campHistory = campHistory,
                        currentPriority = if (currentPriority == "بدون اولویت") "" else currentPriority
                    )
                    onSave(patient)
                },
                colors = ButtonDefaults.buttonColors(containerColor = TealBrand),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.testTag("btn_save_patient")
            ) {
                Icon(imageVector = Icons.Default.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("ذخیره پرونده", fontWeight = FontWeight.Bold)
            }
        }

        if (errorMessage.isNotEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFEE2E2))
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text(text = errorMessage, color = StatusRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Personal Demographic Section
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = "۱. مشخصات هویتی و فردی",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = TealBrand
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianInputField(
                                value = code,
                                onValueChange = { code = it },
                                label = "کد پرونده",
                                isNumber = true,
                                modifier = Modifier.weight(0.4f)
                            )
                            PersianInputField(
                                value = fullName,
                                onValueChange = { fullName = it },
                                label = "نام و نام خانوادگی *",
                                modifier = Modifier.weight(0.6f)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianInputField(
                                value = nationalId,
                                onValueChange = { nationalId = it },
                                label = "کد ملی * (۱۰ رقم)",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                            PersianInputField(
                                value = phone,
                                onValueChange = { phone = it },
                                label = "شماره تماس",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianInputField(
                                value = birthdate,
                                onValueChange = { birthdate = it },
                                label = "تاریخ تولد شمسی",
                                placeholder = "1365/01/01",
                                modifier = Modifier.weight(1f)
                            )
                            PersianInputField(
                                value = age,
                                onValueChange = { age = it },
                                label = "سن (سال)",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianDropdown(
                                selectedItem = gender,
                                items = listOf("مرد", "زن"),
                                label = "جنسیت",
                                onItemSelected = { gender = it },
                                modifier = Modifier.weight(1f)
                            )
                            PersianDropdown(
                                selectedItem = marital,
                                items = listOf("متأهل", "مجرد", "مطلقه - متارکه", "همسر فوت شده"),
                                label = "وضعیت تأهل",
                                onItemSelected = { marital = it },
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianDropdown(
                                selectedItem = employment,
                                items = listOf("شاغل", "بیکار", "بازنشسته", "دانش‌آموز/دانشجو", "خانه دار"),
                                label = "وضعیت اشتغال",
                                onItemSelected = { employment = it },
                                modifier = Modifier.weight(1f)
                            )
                            PersianInputField(
                                value = job,
                                onValueChange = { job = it },
                                label = "عنوان دقیق شغل",
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            // Clinical Admission Details
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = "۲. پذیرش کلینیکی و سوابق مصرف",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = TealBrand
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianInputField(
                                value = admissionDate,
                                onValueChange = { admissionDate = it },
                                label = "تاریخ پذیرش شمسی",
                                modifier = Modifier.weight(1f)
                            )
                            PersianDropdown(
                                selectedItem = insurance,
                                items = listOf("دارد", "ندارد"),
                                label = "پوشش بیمه",
                                onItemSelected = { insurance = it },
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianDropdown(
                                selectedItem = counselor,
                                items = listOf("آقای فتحی", "خانم ابراهیمی", "دکتر حسن‌پور"),
                                label = "مشاور / روانشناس",
                                onItemSelected = { counselor = it },
                                modifier = Modifier.weight(1f)
                            )
                            PersianDropdown(
                                selectedItem = substance,
                                items = listOf("تریاک", "هروئین", "شیره", "شیشه (مت‌آمفتامین)", "ماریجوانا / گل", "الکل", "متادون", "قرص B2", "سایر"),
                                label = "ماده مصرفی اصلی",
                                onItemSelected = { substance = it },
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianInputField(
                                value = startAge,
                                onValueChange = { startAge = it },
                                label = "سن شروع مصرف",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                            PersianInputField(
                                value = duration,
                                onValueChange = { duration = it },
                                label = "مدت مصرف (سال)",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianDropdown(
                                selectedItem = attempts,
                                items = listOf("هیچ‌وقت ترک نکرده", "۱ بار", "۲ تا ۵ بار", "بیش از ۵ بار"),
                                label = "دفعات ترک قبلی",
                                onItemSelected = { attempts = it },
                                modifier = Modifier.weight(1f)
                            )
                            PersianDropdown(
                                selectedItem = campHistory,
                                items = listOf("دارد", "ندارد"),
                                label = "سابقه بستری کمپ",
                                onItemSelected = { campHistory = it },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            // Medical History Checkboxes
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "۳. سوابق بیماری و پزشکی مراجع",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = TealBrand
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        diseases.chunked(2).forEach { rowDiseases ->
                            Row(modifier = Modifier.fillMaxWidth()) {
                                rowDiseases.forEach { d ->
                                    val isChecked = selectedDiseases.contains(d)
                                    Row(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clickable {
                                                if (isChecked) selectedDiseases.remove(d) else selectedDiseases.add(d)
                                            }
                                            .padding(vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Checkbox(
                                            checked = isChecked,
                                            onCheckedChange = { checked ->
                                                if (checked) selectedDiseases.add(d) else selectedDiseases.remove(d)
                                            },
                                            colors = CheckboxDefaults.colors(checkedColor = TealBrand)
                                        )
                                        Text(text = d, fontSize = 12.sp, color = Color(0xFF334155))
                                    }
                                }
                                if (rowDiseases.size == 1) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        PersianInputField(
                            value = medicalNotes,
                            onValueChange = { medicalNotes = it },
                            label = "ملاحظات پزشک و سوابق دارویی خاص",
                            maxLines = 3
                        )
                    }
                }
            }

            // Medication Plan
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = "۴. طرح درمان دارویی و وضعیت حضور",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = TealBrand
                        )

                        val drugChoices = listOf("ش متادون", "ق متادون", "بوپرنورفین", "اپیوم", "روان درمانی")

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianDropdown(
                                selectedItem = initialDrug,
                                items = drugChoices,
                                label = "داروی شروع",
                                onItemSelected = { initialDrug = it },
                                modifier = Modifier.weight(1f)
                            )
                            PersianInputField(
                                value = initialDosage,
                                onValueChange = { initialDosage = it },
                                label = "دوز شروع (سی‌سی/میلی‌گرم)",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianDropdown(
                                selectedItem = currentDrug,
                                items = drugChoices,
                                label = "داروی فعلی",
                                onItemSelected = { currentDrug = it },
                                modifier = Modifier.weight(1f)
                            )
                            PersianInputField(
                                value = currentDosage,
                                onValueChange = { currentDosage = it },
                                label = "دوز فعلی (سی‌سی/میلی‌گرم)",
                                isNumber = true,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PersianDropdown(
                                selectedItem = currentPriority,
                                items = listOf("بدون اولویت", "A1", "A2", "B1", "B2", "B3"),
                                label = "اولویت اپیوم",
                                onItemSelected = { currentPriority = it },
                                modifier = Modifier.weight(1f)
                            )
                            PersianDropdown(
                                selectedItem = attendance,
                                items = listOf("منظم", "نامنظم", "غیبت"),
                                label = "نظم حضور",
                                onItemSelected = { attendance = it },
                                modifier = Modifier.weight(1f)
                            )
                        }

                        PersianDropdown(
                            selectedItem = status,
                            items = listOf("فعال", "غیرفعال"),
                            label = "وضعیت پرونده",
                            onItemSelected = { status = it }
                        )
                    }
                }
            }
        }
    }
}
