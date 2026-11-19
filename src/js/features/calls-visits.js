// نسیم رهایی — پیگیری تلفنی و ویزیت‌ها
// (اسکریپت کلاسیک؛ همه فایل‌های src/js به ترتیب فهرست index.html در یک دامنه سراسری اجرا می‌شوند)

// 5. FOLLOWUP CALL DIALOG - INLINE HANDLER
window.handleInlineCallSubmit = function(event) {
    event.preventDefault();
    const p = activePatientForModal;
    if (!p) return;

    const currentDate = getShamsiToday();
    const resultValue = document.getElementById('inline-call-result').value;

    const callPayload = {
        id: crypto.randomUUID(),
        patientId: p.id,
        patientName: p.fullName || (p.name + ' ' + p.lastname),
        date: currentDate,
        result: resultValue,
        notes: document.getElementById('inline-call-notes').value,
        nextAction: document.getElementById('inline-call-next-action').value,
        recordedBy: "دکتر حسن‌پور"
    };

    window.contactLogs.unshift(callPayload);
    dbPutRecord('contactLogs', callPayload);

    // Align automated status change reasons perfectly
    if (resultValue.includes('مراجعه به مرکز دیگر') || resultValue.includes('مراجه به مرکز دیگر')) {
        p.status = 'غیرفعال';
        p.deactiveReason = 'انتقال به مرکز دیگر';
        p.deactiveNotes = 'پیگیری شده به صورت تلفنی و ارجاع به مرکز موازی.';
        p.attendance = 'غیبت';
    } else if (resultValue.includes('ترک درمان')) {
        p.status = 'غیرفعال';
        p.deactiveReason = 'انصراف از درمان';
        p.deactiveNotes = 'قطع ارادی درمان گزارش شده در بررسی تلفنی.';
        p.attendance = 'غیبت';
    } else if (resultValue.includes('فوت')) {
        p.status = 'غیرفعال';
        p.deactiveReason = 'فوت';
        p.deactiveNotes = 'گزارش فوت مراجع از جانب بستگان درجه یک در پیگیری تلفنی.';
        p.attendance = 'غیبت';
    }

    dbPutRecord('patients', p);
    triggerBackupReminder();

    // Re-render the active modal tab immediately to show newly added log
    renderModalTabBody();

    // Refresh underlying lists quietly
    renderVisitsList();
    renderDashboard();
    renderPatientsList();

    showToast("لاگ تماس پیگیری با موفقیت ثبت شد.");
};

function openVisitModal(id) {
    const p = window.patients.find(pat => pat.id === id);
    if (!p) return;

    document.getElementById('visit-patient-id').value = id;
    document.getElementById('visit-edit-id').value = '';
    document.getElementById('visit-modal-header-title').innerText = "ثبت ویزیت بالینی جدید (Clinical CRM)";

    document.getElementById('v-m-code').innerText = p.code;
    document.getElementById('v-m-name').innerText = p.fullName || (p.name + ' ' + p.lastname);
    document.getElementById('v-m-substance').innerText = p.substance;
    document.getElementById('v-m-drug').innerText = `${p.currentDrug} (${formatDosagePlain(p.currentDrug, p.currentDosage)})`;

    // اعمال تابع استاندارد تاریخ (رفع بقایای باگ تقویم)
    document.getElementById('visit-date').value = getShamsiToday(); 
    document.getElementById('visit-drug').value = 'بدون تغییر';

    // رفع باگ نشت اطلاعات: پاکسازی فیلدهای یادداشت و وضعیت برای جلوگیری از تداخل پرونده‌ها
    document.getElementById('visit-status').value = 'ادامه درمان'; 
    document.getElementById('visit-notes').value = ''; 

    // Reset newly added test fields
    document.getElementById('visit-lab-request').checked = false;
    document.getElementById('visit-addiction-test').checked = false;
    document.getElementById('visit-test-result').value = '';

    // Auto-fill active patient current dosage and unit label as default
    updateVisitDosageFields(p, 'بدون تغییر');
    updateVisitPriorityField(p, 'بدون تغییر');

    document.getElementById('visit-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

function closeVisitModal() {
    document.getElementById('visit-modal').classList.add('hidden');
    unlockBackgroundScroll();
}

function editVisitRecord(visitId) {
    const v = window.visits.find(visit => visit.id === visitId);
    if (!v) return;

    const p = window.patients.find(pat => pat.id === v.patientId);
    if (!p) return;

    // Set state inside the clinical visit form
    document.getElementById('visit-patient-id').value = p.id;
    document.getElementById('visit-edit-id').value = v.id;
    document.getElementById('visit-modal-header-title').innerText = "ویرایش ویزیت بالینی (Clinical CRM)";

    document.getElementById('v-m-code').innerText = p.code;
    document.getElementById('v-m-name').innerText = p.fullName || (p.name + ' ' + p.lastname);
    document.getElementById('v-m-substance').innerText = p.substance;
    document.getElementById('v-m-drug').innerText = `${v.prevDrug} (${v.prevDosage || '-'})`;

    document.getElementById('visit-date').value = v.date;
    document.getElementById('visit-doctor').value = v.physician || '';

    // Populate newly added test fields
    document.getElementById('visit-lab-request').checked = v.labRequest || false;
    document.getElementById('visit-addiction-test').checked = v.addictionTest || false;
    document.getElementById('visit-test-result').value = v.testResult || '';

    if (v.newDrug === v.prevDrug) {
        document.getElementById('visit-drug').value = 'بدون تغییر';
    } else {
        document.getElementById('visit-drug').value = v.newDrug;
    }

    updateVisitDosageFields(p, document.getElementById('visit-drug').value);
    document.getElementById('visit-dosage').value = v.newDosage;

    updateVisitPriorityField(p, document.getElementById('visit-drug').value);
    if (v.newDrug === 'اپیوم' && document.getElementById('visit-priority')) {
        // Prefer what was actually recorded on this visit over the patient's current state
        document.getElementById('visit-priority').value = v.newPriority || p.currentPriority || '';
    }

    document.getElementById('visit-status').value = v.status;
    document.getElementById('visit-notes').value = v.notes;

    // Close overlapping modals cleanly and open visit form
    document.getElementById('details-modal').classList.add('hidden');
    unlockBackgroundScroll();

    document.getElementById('visit-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

function deleteVisitRecord(visitId) {
    const v = window.visits.find(visit => visit.id === visitId);
    if (!v) return;

    showCustomConfirm(
        "حذف دائمی رکورد ویزیت",
        "آیا از حذف کامل و غیرقابل بازگشت این رکورد ویزیت طولی اطمینان دارید؟",
        () => {
            const patientId = v.patientId;
            window.visits = window.visits.filter(visit => visit.id !== visitId);
            dbDeleteRecord('visits', visitId);

            // Keep patient current state synced if deleted visit was the latest
            const patient = window.patients.find(p => p.id === patientId);
            if (patient) {
                const sortedVisits = window.visits
                    .filter(visit => visit.patientId === patientId)
                    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

                if (sortedVisits.length > 0) {
                    patient.currentDrug = sortedVisits[0].newDrug;
                    patient.currentDosage = sortedVisits[0].newDosage;
                } else {
                    patient.currentDrug = patient.initialDrug;
                    patient.currentDosage = patient.initialDosage;
                }
                dbPutRecord('patients', patient);
            }

            triggerBackupReminder();

            // Refresh dialog view instantly
            if (activePatientForModal && activePatientForModal.id === patientId) {
                renderModalTabBody();
            } else {
                closeDetailsModal();
            }

            renderVisitsList();
            renderDashboard();
            renderPatientsList();
            showToast("رکورد ویزیت با موفقیت حذف گردید.");
        }
    );
}

function handleVisitSubmit(event) {
    event.preventDefault();

    const pId = document.getElementById('visit-patient-id').value;
    const patient = window.patients.find(p => p.id === pId);
    if (!patient) return;

    const selectedDrugAction = document.getElementById('visit-drug').value;
    let finalDrug = patient.currentDrug;

    if (selectedDrugAction !== 'بدون تغییر') {
        finalDrug = selectedDrugAction;
    }

    // Dosage change is completely independent of "تغییر نوع دارو"
    let finalDosage = 0;
    if (finalDrug !== 'بدون دارو (فقط روان‌درمانی)') {
        finalDosage = parseFloat(document.getElementById('visit-dosage').value) || 0;
    }

    // Priority (اولویت اپیوم) only applies when the resulting drug is اپیوم
    let finalPriority = '';
    if (finalDrug === 'اپیوم') {
        const priorityEl = document.getElementById('visit-priority');
        finalPriority = priorityEl ? priorityEl.value : '';
    }

    const visitStatus = document.getElementById('visit-status').value;

    // Capture test fields
    const visitLabRequest = document.getElementById('visit-lab-request').checked;
    const visitAddictionTest = document.getElementById('visit-addiction-test').checked;
    const visitTestResult = document.getElementById('visit-test-result').value;

    // Direct route: Edit vs creation logic separation
    const editId = document.getElementById('visit-edit-id').value;

    if (editId) {
        const vIndex = window.visits.findIndex(v => v.id === editId);
        if (vIndex > -1) {
            const oldV = window.visits[vIndex];
            window.visits[vIndex] = {
                ...oldV,
                date: document.getElementById('visit-date').value,
                notes: document.getElementById('visit-notes').value,
                newDrug: finalDrug,
                newDosage: finalDosage,
                newPriority: finalPriority,
                status: visitStatus,
                physician: document.getElementById('visit-doctor').value,
                labRequest: visitLabRequest,
                addictionTest: visitAddictionTest,
                testResult: visitTestResult
            };

            dbPutRecord('visits', window.visits[vIndex]);

            // Re-calculate latest state of the patient cleanly
            const sortedVisits = window.visits
                .filter(v => v.patientId === pId)
                .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
            if (sortedVisits.length > 0 && sortedVisits[0].id === editId) {
                if ((patient.currentPriority || '') !== finalPriority) {
                    logChange(patient.id, "اولویت اپیوم (ویرایش ویزیت)", patient.currentPriority || "-", finalPriority || "-");
                }
                patient.currentDrug = finalDrug;
                patient.currentDosage = finalDosage;
                patient.currentPriority = finalPriority;
            }
            showToast(`ویزیت مورخ ${oldV.date} با موفقیت ویرایش شد.`);
        }
    } else {
        const newVisitPayload = {
            id: crypto.randomUUID(),
            patientId: pId,
            date: document.getElementById('visit-date').value,
            notes: document.getElementById('visit-notes').value,
            prevDrug: patient.currentDrug,
            newDrug: finalDrug,
            prevDosage: patient.currentDosage,
            newDosage: finalDosage,
            prevPriority: patient.currentPriority || '',
            newPriority: finalPriority,
            status: visitStatus,
            physician: document.getElementById('visit-doctor').value,
            labRequest: visitLabRequest,
            addictionTest: visitAddictionTest,
            testResult: visitTestResult,
            recordedBy: "دکتر حسن‌پور"
        };

        window.visits.unshift(newVisitPayload);
        dbPutRecord('visits', newVisitPayload);

        if ((patient.currentPriority || '') !== finalPriority) {
            logChange(patient.id, "اولویت اپیوم (ویزیت)", patient.currentPriority || "-", finalPriority || "-");
        }

        // Update patient current medical status parameters cleanly
        patient.currentDrug = finalDrug;
        patient.currentDosage = finalDosage;
        patient.currentPriority = finalPriority;

        // Auto-apply aligned reasons if treatment gets discharged or canceled
        if (visitStatus === 'ترخیص') {
            patient.status = 'غیرفعال';
            patient.deactiveReason = 'بهبودی کامل (ترخیص)';
            patient.deactiveNotes = 'بهبود بالینی تایید شده توسط پزشک در آخرین ویزیت طولی.';
            patient.attendance = 'غیبت';
        } else if (visitStatus === 'قطع درمان') {
            patient.status = 'غیرفعال';
            patient.deactiveReason = 'انصراف از درمان';
            patient.deactiveNotes = 'درخواست قطع ارادی درمان در ثبت ویزیت بالینی.';
            patient.attendance = 'غیبت';
        } else {
            patient.attendance = 'منظم'; // Patient successfully attended active clinic visit
        }
    }

    dbPutRecord('patients', patient);
    // یکپارچه‌سازی دوطرفه اولویت اپیوم: تغییر اولویت در ویزیت نیز در فهرست مدیریت اپیوم منعکس شود.
    if (typeof opSyncMemberPriorityFromPatient === 'function') { try { opSyncMemberPriorityFromPatient(patient.id, patient.currentPriority || ''); } catch (e) {} }
    triggerBackupReminder();

    closeVisitModal();
    renderVisitsList();
    renderDashboard();
    renderPatientsList();
    if (typeof renderOpiumPage === 'function' && document.getElementById('tab-opium') && !document.getElementById('tab-opium').classList.contains('hidden')) { try { renderOpiumPage(); } catch (e) {} }
}

