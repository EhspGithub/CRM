package com.example.nasimrahayi.data.repository

import com.example.nasimrahayi.data.local.AppDatabase
import com.example.nasimrahayi.data.model.ClinicSettings
import com.example.nasimrahayi.data.model.DispenseRecord
import com.example.nasimrahayi.data.model.OpiumDelivery
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.data.model.Visit
import kotlinx.coroutines.flow.Flow

class ClinicRepository(private val db: AppDatabase) {

    val allPatients: Flow<List<Patient>> = db.patientDao().getAllPatients()
    val allVisits: Flow<List<Visit>> = db.visitDao().getAllVisits()
    val allDispenses: Flow<List<DispenseRecord>> = db.dispenseDao().getAllDispenses()
    val allOpiumDeliveries: Flow<List<OpiumDelivery>> = db.opiumDao().getAllDeliveries()
    val settings: Flow<ClinicSettings?> = db.settingsDao().getSettings()

    fun getPatientById(id: String): Flow<Patient?> = db.patientDao().getPatientById(id)
    suspend fun getPatientByIdSync(id: String): Patient? = db.patientDao().getPatientByIdSync(id)

    fun getVisitsForPatient(patientId: String): Flow<List<Visit>> =
        db.visitDao().getVisitsForPatient(patientId)

    fun getDispensesForPatient(patientId: String): Flow<List<DispenseRecord>> =
        db.dispenseDao().getDispensesForPatient(patientId)

    fun getOpiumDeliveriesForPatient(patientId: String): Flow<List<OpiumDelivery>> =
        db.opiumDao().getDeliveriesForPatient(patientId)

    suspend fun getNextPatientCode(): Int {
        val max = db.patientDao().getMaxCode() ?: 1000
        return max + 1
    }

    suspend fun savePatient(patient: Patient) {
        db.patientDao().insertPatient(patient)
    }

    suspend fun deletePatient(patient: Patient) {
        db.patientDao().deletePatient(patient)
    }

    suspend fun saveVisit(visit: Visit) {
        db.visitDao().insertVisit(visit)
        // Also update patient's current medication & dosage if changed
        val currentPatient = db.patientDao().getPatientByIdSync(visit.patientId)
        if (currentPatient != null && (visit.newDrug.isNotEmpty() || visit.newDosage > 0)) {
            val updated = currentPatient.copy(
                currentDrug = visit.newDrug.ifEmpty { currentPatient.currentDrug },
                currentDosage = if (visit.newDosage > 0) visit.newDosage else currentPatient.currentDosage
            )
            db.patientDao().updatePatient(updated)
        }
    }

    suspend fun deleteVisit(visit: Visit) {
        db.visitDao().deleteVisit(visit)
    }

    suspend fun saveDispense(record: DispenseRecord) {
        db.dispenseDao().insertDispense(record)
    }

    suspend fun deleteDispense(record: DispenseRecord) {
        db.dispenseDao().deleteDispense(record)
    }

    suspend fun saveOpiumDelivery(delivery: OpiumDelivery) {
        db.opiumDao().insertDelivery(delivery)
    }

    suspend fun updateOpiumDelivery(delivery: OpiumDelivery) {
        db.opiumDao().updateDelivery(delivery)
    }

    suspend fun deleteOpiumDelivery(delivery: OpiumDelivery) {
        db.opiumDao().deleteDelivery(delivery)
    }

    suspend fun saveSettings(settings: ClinicSettings) {
        db.settingsDao().insertOrUpdate(settings)
    }

    suspend fun resetToSampleData() {
        db.clearAndResetData()
    }

    suspend fun ensureInitialized() {
        val settings = db.settingsDao().getSettingsSync()
        if (settings == null) {
            db.seedInitialData()
        }
    }
}
