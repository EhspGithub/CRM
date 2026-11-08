package com.example.nasimrahayi.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.nasimrahayi.data.model.ClinicSettings
import com.example.nasimrahayi.data.model.DispenseRecord
import com.example.nasimrahayi.data.model.OpiumDelivery
import com.example.nasimrahayi.data.model.Patient
import com.example.nasimrahayi.data.model.Visit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [
        Patient::class,
        Visit::class,
        DispenseRecord::class,
        OpiumDelivery::class,
        ClinicSettings::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun patientDao(): PatientDao
    abstract fun visitDao(): VisitDao
    abstract fun dispenseDao(): DispenseDao
    abstract fun opiumDao(): OpiumDao
    abstract fun settingsDao(): SettingsDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "nasim_rahayi.db"
                ).addCallback(object : Callback() {
                    override fun onCreate(db: SupportSQLiteDatabase) {
                        super.onCreate(db)
                        CoroutineScope(Dispatchers.IO).launch {
                            getDatabase(context).seedInitialData()
                        }
                    }
                }).build()
                INSTANCE = instance
                instance
            }
        }
    }

    suspend fun seedInitialData() {
        patientDao().insertPatients(DatabaseSeed.samplePatients)
        visitDao().insertVisits(DatabaseSeed.sampleVisits)
        dispenseDao().insertDispenses(DatabaseSeed.sampleDispenses)
        opiumDao().insertDeliveries(DatabaseSeed.sampleOpiumDeliveries)
        settingsDao().insertOrUpdate(DatabaseSeed.defaultSettings)
    }

    suspend fun clearAndResetData() {
        patientDao().deleteAllPatients()
        visitDao().deleteAllVisits()
        dispenseDao().deleteAllDispenses()
        opiumDao().deleteAllDeliveries()
        seedInitialData()
    }
}
