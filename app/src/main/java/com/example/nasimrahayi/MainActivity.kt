package com.example.nasimrahayi

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.ui.MainViewModel
import com.example.nasimrahayi.ui.components.AppHeader
import com.example.nasimrahayi.ui.navigation.Screen
import com.example.nasimrahayi.ui.screens.AddEditPatientScreen
import com.example.nasimrahayi.ui.screens.DashboardScreen
import com.example.nasimrahayi.ui.screens.DispenseScreen
import com.example.nasimrahayi.ui.screens.LockScreen
import com.example.nasimrahayi.ui.screens.OpiumScreen
import com.example.nasimrahayi.ui.screens.PatientDetailScreen
import com.example.nasimrahayi.ui.screens.PatientsScreen
import com.example.nasimrahayi.ui.screens.ReportsScreen
import com.example.nasimrahayi.ui.screens.SettingsScreen
import com.example.nasimrahayi.ui.screens.VisitsScreen
import com.example.nasimrahayi.ui.theme.DarkSidebar
import com.example.nasimrahayi.ui.theme.NasimRahayiTheme
import com.example.nasimrahayi.ui.theme.TealBrand

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            NasimRahayiTheme {
                MainApp()
            }
        }
    }
}

data class NavItem(
    val title: String,
    val icon: ImageVector,
    val screen: Screen,
    val testTag: String
)

@Composable
fun MainApp(viewModel: MainViewModel = viewModel()) {
    val currentScreen by viewModel.currentScreen.collectAsState()
    val isLocked by viewModel.isLocked.collectAsState()
    val patients by viewModel.allPatients.collectAsState()
    val visits by viewModel.allVisits.collectAsState()
    val dispenses by viewModel.allDispenses.collectAsState()
    val opiumDeliveries by viewModel.allOpiumDeliveries.collectAsState()
    val settings by viewModel.settings.collectAsState()

    val searchQuery by viewModel.searchQuery.collectAsState()
    val statusFilter by viewModel.selectedStatusFilter.collectAsState()
    val drugFilter by viewModel.selectedDrugFilter.collectAsState()

    var quickPatientForVisit by remember { mutableStateOf<Patient?>(null) }
    var quickPatientForDispense by remember { mutableStateOf<Patient?>(null) }

    // Handle back button
    BackHandler(enabled = currentScreen !is Screen.Dashboard) {
        when (currentScreen) {
            is Screen.PatientDetail -> viewModel.navigateTo(Screen.Patients)
            is Screen.EditPatient -> viewModel.navigateTo(Screen.Patients)
            else -> viewModel.navigateTo(Screen.Dashboard)
        }
    }

    if (isLocked) {
        LockScreen(
            onUnlock = { pin -> viewModel.unlockApp(pin) }
        )
    } else {
        Scaffold(
            topBar = {
                AppHeader(
                    shamsiDate = viewModel.shamsiFormatted,
                    managerName = settings.managerName,
                    onLockClick = { viewModel.lockApp() }
                )
            },
            bottomBar = {
                val navItems = listOf(
                    NavItem("داشبورد", Icons.Default.Dashboard, Screen.Dashboard, "nav_dashboard"),
                    NavItem("پرونده‌ها", Icons.Default.People, Screen.Patients, "nav_patients"),
                    NavItem("ویزیت", Icons.Default.EventNote, Screen.Visits, "nav_visits"),
                    NavItem("دارو", Icons.Default.Medication, Screen.Dispense, "nav_dispense"),
                    NavItem("اپیوم", Icons.Default.LocalDrink, Screen.Opium, "nav_opium"),
                    NavItem("گزارش‌ها", Icons.Default.Analytics, Screen.Reports, "nav_reports"),
                    NavItem("تنظیمات", Icons.Default.Settings, Screen.Settings, "nav_settings")
                )

                val selectedIndex = when (currentScreen) {
                    is Screen.Dashboard -> 0
                    is Screen.Patients, is Screen.PatientDetail, is Screen.EditPatient -> 1
                    is Screen.Visits -> 2
                    is Screen.Dispense -> 3
                    is Screen.Opium -> 4
                    is Screen.Reports -> 5
                    is Screen.Settings -> 6
                }

                NavigationBar(
                    containerColor = DarkSidebar,
                    contentColor = Color.White
                ) {
                    navItems.forEachIndexed { index, item ->
                        val selected = selectedIndex == index
                        NavigationBarItem(
                            selected = selected,
                            onClick = { viewModel.navigateTo(item.screen) },
                            icon = {
                                Icon(
                                    imageVector = item.icon,
                                    contentDescription = item.title,
                                    tint = if (selected) Color.White else Color(0xFF94A3B8)
                                )
                            },
                            label = {
                                Text(
                                    text = item.title,
                                    fontSize = 10.sp,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (selected) Color.White else Color(0xFF94A3B8)
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                indicatorColor = TealBrand
                            ),
                            modifier = Modifier.testTag(item.testTag)
                        )
                    }
                }
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                when (val screen = currentScreen) {
                    is Screen.Dashboard -> {
                        DashboardScreen(
                            patients = patients,
                            visits = visits,
                            onNavigate = { viewModel.navigateTo(it) },
                            onDeletePatient = { viewModel.deletePatient(it) }
                        )
                    }

                    is Screen.Patients -> {
                        PatientsScreen(
                            patients = patients,
                            searchQuery = searchQuery,
                            onSearchChange = { viewModel.onSearchQueryChange(it) },
                            statusFilter = statusFilter,
                            onStatusFilterChange = { viewModel.setStatusFilter(it) },
                            drugFilter = drugFilter,
                            onDrugFilterChange = { viewModel.setDrugFilter(it) },
                            onNavigate = { viewModel.navigateTo(it) },
                            onToggleStatus = { viewModel.togglePatientStatus(it) },
                            onDeletePatient = { viewModel.deletePatient(it) },
                            onAddVisitClick = { patient ->
                                quickPatientForVisit = patient
                                viewModel.navigateTo(Screen.Visits)
                            },
                            onDispenseClick = { patient ->
                                quickPatientForDispense = patient
                                viewModel.navigateTo(Screen.Dispense)
                            }
                        )
                    }

                    is Screen.PatientDetail -> {
                        val patient = patients.find { it.id == screen.patientId }
                        PatientDetailScreen(
                            patient = patient,
                            visits = visits,
                            dispenses = dispenses,
                            opiumDeliveries = opiumDeliveries,
                            onBack = { viewModel.navigateTo(Screen.Patients) },
                            onEdit = { id -> viewModel.navigateTo(Screen.EditPatient(id)) },
                            onAddVisit = { p ->
                                quickPatientForVisit = p
                                viewModel.navigateTo(Screen.Visits)
                            },
                            onDispense = { p ->
                                quickPatientForDispense = p
                                viewModel.navigateTo(Screen.Dispense)
                            }
                        )
                    }

                    is Screen.EditPatient -> {
                        val existing = if (screen.patientId != null) {
                            patients.find { it.id == screen.patientId }
                        } else null

                        AddEditPatientScreen(
                            existingPatient = existing,
                            shamsiToday = viewModel.shamsiToday,
                            onGetNextCode = { viewModel.getNextPatientCode() },
                            onSave = { saved ->
                                viewModel.savePatient(saved) {
                                    viewModel.navigateTo(Screen.Patients)
                                }
                            },
                            onCancel = { viewModel.navigateTo(Screen.Patients) }
                        )
                    }

                    is Screen.Visits -> {
                        VisitsScreen(
                            visits = visits,
                            patients = patients,
                            shamsiToday = viewModel.shamsiToday,
                            initialSelectedPatient = quickPatientForVisit,
                            onAddVisit = { patient, newDrug, newDosage, status, notes, nextDate ->
                                viewModel.addVisit(patient, newDrug, newDosage, status, notes, nextDate) {
                                    quickPatientForVisit = null
                                }
                            },
                            onDeleteVisit = { viewModel.deleteVisit(it) }
                        )
                    }

                    is Screen.Dispense -> {
                        DispenseScreen(
                            dispenses = dispenses,
                            patients = patients,
                            shamsiToday = viewModel.shamsiToday,
                            initialSelectedPatient = quickPatientForDispense,
                            onAddDispense = { patient, drug, dosage, days, notes ->
                                viewModel.addDispense(patient, drug, dosage, days, notes) {
                                    quickPatientForDispense = null
                                }
                            },
                            onDeleteDispense = { viewModel.deleteDispense(it) }
                        )
                    }

                    is Screen.Opium -> {
                        OpiumScreen(
                            deliveries = opiumDeliveries,
                            patients = patients,
                            shamsiToday = viewModel.shamsiToday,
                            onAddDelivery = { patient, amountCc, notes ->
                                viewModel.addOpiumDelivery(patient, amountCc, notes) {}
                            },
                            onToggleVoid = { viewModel.toggleVoidOpiumDelivery(it) },
                            onDeleteDelivery = { viewModel.deleteOpiumDelivery(it) }
                        )
                    }

                    is Screen.Reports -> {
                        ReportsScreen(
                            patients = patients,
                            visits = visits,
                            dispenses = dispenses
                        )
                    }

                    is Screen.Settings -> {
                        SettingsScreen(
                            settings = settings,
                            onSaveSettings = { viewModel.saveSettings(it) },
                            onResetToSampleData = { viewModel.resetToSampleData() }
                        )
                    }
                }
            }
        }
    }
}
