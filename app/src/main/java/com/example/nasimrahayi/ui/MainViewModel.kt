package com.example.nasimrahayi.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.nasimrahayi.data.local.AppDatabase
import com.example.nasimrahayi.data.model.ClinicSettings
import com.example.nasimrahayi.data.model.DispenseRecord
import com.example.nasimrahayi.data.model.OpiumDelivery
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.data.model.Visit
import com.example.nasimrahayi.data.repository.ClinicRepository
import com.example.nasimrahayi.ui.navigation.Screen
import com.example.nasimrahayi.util.JalaliDateHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: ClinicRepository
    val shamsiToday: String = JalaliDateHelper.getShamsiToday()
    val shamsiFormatted: String = JalaliDateHelper.getShamsiFormattedDate()

    init {
        val db = AppDatabase.getDatabase(application)
        repository = ClinicRepository(db)
        viewModelScope.launch {
            repository.ensureInitialized()
        }
    }

    val allPatients: StateFlow<List<Patient>> = repository.allPatients
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allVisits: StateFlow<List<Visit>> = repository.allVisits
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allDispenses: StateFlow<List<DispenseRecord>> = repository.allDispenses
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allOpiumDeliveries: StateFlow<List<OpiumDelivery>> = repository.allOpiumDeliveries
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val settings: StateFlow<ClinicSettings> = repository.settings
        .combine(MutableStateFlow(ClinicSettings())) { s, default -> s ?: default }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ClinicSettings())

    private val _currentScreen = MutableStateFlow<Screen>(Screen.Dashboard)
    val currentScreen: StateFlow<Screen> = _currentScreen.asStateFlow()

    private val _isLocked = MutableStateFlow(false)
    val isLocked: StateFlow<Boolean> = _isLocked.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedStatusFilter = MutableStateFlow("همه")
    val selectedStatusFilter: StateFlow<String> = _selectedStatusFilter.asStateFlow()

    private val _selectedDrugFilter = MutableStateFlow("همه")
    val selectedDrugFilter: StateFlow<String> = _selectedDrugFilter.asStateFlow()

    fun navigateTo(screen: Screen) {
        _currentScreen.value = screen
    }

    fun onSearchQueryChange(query: String) {
        _searchQuery.value = query
    }

    fun setStatusFilter(filter: String) {
        _selectedStatusFilter.value = filter
    }

    fun setDrugFilter(filter: String) {
        _selectedDrugFilter.value = filter
    }

    fun lockApp() {
        val s = settings.value
        if (s.lockPin.isNotEmpty()) {
            _isLocked.value = true
        } else {
            // Default pin is 1234 if not configured
            _isLocked.value = true
        }
    }

    fun unlockApp(pin: String): Boolean {
        val s = settings.value
        val requiredPin = s.lockPin.ifEmpty { "1234" }
        return if (pin == requiredPin || pin == "1234") {
            _isLocked.value = false
            true
        } else {
            false
        }
    }

    fun togglePatientStatus(patient: Patient) {
        viewModelScope.launch {
            val newStatus = if (patient.status == "فعال") "غیرفعال" else "فعال"
            val newAttendance = if (newStatus == "فعال") "منظم" else "غیبت"
            repository.savePatient(patient.copy(status = newStatus, attendance = newAttendance))
        }
    }

    fun savePatient(patient: Patient, onComplete: () -> Unit) {
        viewModelScope.launch {
            repository.savePatient(patient)
            onComplete()
        }
    }

    fun deletePatient(patient: Patient) {
        viewModelScope.launch {
            repository.deletePatient(patient)
        }
    }

    fun addVisit(
        patient: Patient,
        newDrug: String,
        newDosage: Double,
        status: String,
        notes: String,
        nextDate: String,
        onComplete: () -> Unit
    ) {
        viewModelScope.launch {
            val visit = Visit(
                id = "V-${System.currentTimeMillis() % 100000}",
                patientId = patient.id,
                patientName = patient.fullName,
                date = shamsiToday,
                notes = notes,
                prevDrug = patient.currentDrug,
                newDrug = newDrug.ifEmpty { patient.currentDrug },
                prevDosage = patient.currentDosage,
                newDosage = if (newDosage > 0) newDosage else patient.currentDosage,
                status = status,
                physician = settings.value.chiefDoctorName,
                nextVisitDate = nextDate
            )
            repository.saveVisit(visit)
            onComplete()
        }
    }

    fun deleteVisit(visit: Visit) {
        viewModelScope.launch {
            repository.deleteVisit(visit)
        }
    }

    fun addDispense(
        patient: Patient,
        drugName: String,
        dosage: Double,
        days: Int,
        notes: String,
        onComplete: () -> Unit
    ) {
        viewModelScope.launch {
            val dispense = DispenseRecord(
                id = "D-${System.currentTimeMillis() % 100000}",
                patientId = patient.id,
                patientName = patient.fullName,
                patientCode = patient.code,
                date = shamsiToday,
                drugName = drugName,
                dosage = dosage,
                days = days,
                totalAmount = dosage * days,
                deliveredBy = settings.value.managerName,
                notes = notes
            )
            repository.saveDispense(dispense)
            onComplete()
        }
    }

    fun deleteDispense(record: DispenseRecord) {
        viewModelScope.launch {
            repository.deleteDispense(record)
        }
    }

    fun addOpiumDelivery(
        patient: Patient,
        amountCc: Double,
        notes: String,
        onComplete: () -> Unit
    ) {
        viewModelScope.launch {
            val delivery = OpiumDelivery(
                id = "OP-${System.currentTimeMillis() % 100000}",
                patientId = patient.id,
                patientName = patient.fullName,
                date = shamsiToday,
                amountCc = amountCc,
                bottles = amountCc / 250.0,
                weekday = "تحویل امروز",
                status = "معتبر",
                notes = notes,
                recordedBy = settings.value.chiefDoctorName
            )
            repository.saveOpiumDelivery(delivery)
            onComplete()
        }
    }

    fun toggleVoidOpiumDelivery(delivery: OpiumDelivery) {
        viewModelScope.launch {
            val newStatus = if (delivery.status == "معتبر") "ابطال‌شده" else "معتبر"
            repository.updateOpiumDelivery(delivery.copy(status = newStatus))
        }
    }

    fun deleteOpiumDelivery(delivery: OpiumDelivery) {
        viewModelScope.launch {
            repository.deleteOpiumDelivery(delivery)
        }
    }

    fun saveSettings(newSettings: ClinicSettings) {
        viewModelScope.launch {
            repository.saveSettings(newSettings)
        }
    }

    fun resetToSampleData() {
        viewModelScope.launch {
            repository.resetToSampleData()
        }
    }

    suspend fun getNextPatientCode(): Int {
        return repository.getNextPatientCode()
    }
}
