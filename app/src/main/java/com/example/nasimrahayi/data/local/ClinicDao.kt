package com.example.nasimrahayi.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.example.nasimrahayi.data.model.ClinicSettings
import com.example.nasimrahayi.data.model.DispenseRecord
import com.example.nasimrahayi.data.model.OpiumDelivery
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.data.model.Visit
import kotlinx.coroutines.flow.Flow

@Dao
interface PatientDao {
    @Query("SELECT * FROM patients ORDER BY code DESC")
    fun getAllPatients(): Flow<List<Patient>>

    @Query("SELECT * FROM patients WHERE id = :id LIMIT 1")
    fun getPatientById(id: String): Flow<Patient?>

    @Query("SELECT * FROM patients WHERE id = :id LIMIT 1")
    suspend fun getPatientByIdSync(id: String): Patient?

    @Query("SELECT MAX(code) FROM patients")
    suspend fun getMaxCode(): Int?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPatient(patient: Patient)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPatients(patients: List<Patient>)

    @Update
    suspend fun updatePatient(patient: Patient)

    @Delete
    suspend fun deletePatient(patient: Patient)

    @Query("DELETE FROM patients")
    suspend fun deleteAllPatients()
}

@Dao
interface VisitDao {
    @Query("SELECT * FROM visits ORDER BY date DESC, id DESC")
    fun getAllVisits(): Flow<List<Visit>>

    @Query("SELECT * FROM visits WHERE patientId = :patientId ORDER BY date DESC")
    fun getVisitsForPatient(patientId: String): Flow<List<Visit>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVisit(visit: Visit)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVisits(visits: List<Visit>)

    @Delete
    suspend fun deleteVisit(visit: Visit)

    @Query("DELETE FROM visits")
    suspend fun deleteAllVisits()
}

@Dao
interface DispenseDao {
    @Query("SELECT * FROM dispense_records ORDER BY timestamp DESC")
    fun getAllDispenses(): Flow<List<DispenseRecord>>

    @Query("SELECT * FROM dispense_records WHERE patientId = :patientId ORDER BY timestamp DESC")
    fun getDispensesForPatient(patientId: String): Flow<List<DispenseRecord>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDispense(record: DispenseRecord)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDispenses(records: List<DispenseRecord>)

    @Delete
    suspend fun deleteDispense(record: DispenseRecord)

    @Query("DELETE FROM dispense_records")
    suspend fun deleteAllDispenses()
}

@Dao
interface OpiumDao {
    @Query("SELECT * FROM opium_deliveries ORDER BY date DESC, timestamp DESC")
    fun getAllDeliveries(): Flow<List<OpiumDelivery>>

    @Query("SELECT * FROM opium_deliveries WHERE patientId = :patientId ORDER BY date DESC")
    fun getDeliveriesForPatient(patientId: String): Flow<List<OpiumDelivery>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDelivery(delivery: OpiumDelivery)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDeliveries(deliveries: List<OpiumDelivery>)

    @Update
    suspend fun updateDelivery(delivery: OpiumDelivery)

    @Delete
    suspend fun deleteDelivery(delivery: OpiumDelivery)

    @Query("DELETE FROM opium_deliveries")
    suspend fun deleteAllDeliveries()
}

@Dao
interface SettingsDao {
    @Query("SELECT * FROM clinic_settings WHERE id = 1 LIMIT 1")
    fun getSettings(): Flow<ClinicSettings?>

    @Query("SELECT * FROM clinic_settings WHERE id = 1 LIMIT 1")
    suspend fun getSettingsSync(): ClinicSettings?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(settings: ClinicSettings)
}
