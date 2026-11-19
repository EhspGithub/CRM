// نسیم رهایی — تنظیمات و کادر درمان
// (اسکریپت کلاسیک؛ همه فایل‌های src/js به ترتیب فهرست index.html در یک دامنه سراسری اجرا می‌شوند)

// ================= 8. SYSTEM SETTINGS CONTROLLERS =================
function renderSettings() {
    // Clinic Settings Inputs
    document.getElementById('setting-clinicName').value = window.settings.clinicName || '';
    document.getElementById('setting-displayTitle').value = window.settings.displayTitle || '';
    document.getElementById('setting-managerName').value = window.settings.managerName || '';
    document.getElementById('setting-chiefDoctorName').value = window.settings.chiefDoctorName || '';
    document.getElementById('setting-city').value = window.settings.city || '';
    document.getElementById('setting-phone').value = window.settings.phone || '';
    document.getElementById('setting-mobile').value = window.settings.mobile || '';
    document.getElementById('setting-address').value = window.settings.address || '';
    document.getElementById('setting-description').value = window.settings.description || '';

    // Render Doctors and Psychologists ManagerLists
    renderStaffSettingsLists();
}

let editingStaff = { type: null, index: null };

function startEditStaff(type, index) {
    editingStaff.type = type;
    editingStaff.index = index;
    renderStaffSettingsLists();
}

function cancelEditStaff() {
    editingStaff.type = null;
    editingStaff.index = null;
    renderStaffSettingsLists();
}

function saveStaffMember(type, index) {
    const inputVal = document.getElementById(`input-edit-${type}-${index}`).value.trim();
    if (!inputVal) {
        showCustomAlert("خطای ویرایش", "نام کادر درمان نمی‌تواند خالی باشد!");
        return;
    }

    const oldName = window.staff[type][index];
    if (oldName === inputVal) {
        cancelEditStaff();
        return;
    }

    if (window.staff[type].includes(inputVal)) {
        showCustomAlert("کادر درمانی تکراری", "این نام قبلاً در سامانه ثبت شده است!");
        return;
    }

    // Update patients/visits referencing this staff member for data consistency
    window.patients.forEach(p => {
        if (type === 'psychologists') {
            if (p.counselor === oldName) {
                p.counselor = inputVal;
            }
        }
    });

    window.visits.forEach(v => {
        if (type === 'doctors') {
            if (v.physician === oldName) { v.physician = inputVal; dbPutRecord('visits', v); }
            if (v.recordedBy === oldName) { v.recordedBy = inputVal; dbPutRecord('visits', v); }
        }
    });

    window.staff[type][index] = inputVal;
    dbPutRecord('staff', { id: 'main', data: window.staff });
    triggerBackupReminder();

    applySettings();
    cancelEditStaff();
    showToast("اطلاعات کادر درمان با موفقیت ویرایش شد.");
}

// نگهداری وضعیت نمایش/عدم‌نمایش بخش بایگانی برای هر نوع کادر درمان
let staffArchivedVisible = { doctors: false, psychologists: false };

function archivedKeyFor(type) {
    return type === 'doctors' ? 'archivedDoctors' : 'archivedPsychologists';
}

function staffRoleLabel(type) {
    return type === 'doctors' ? 'پزشک' : 'روانشناس / مشاور';
}

function staffEmptyLabel(type) {
    return type === 'doctors' ? 'هنوز پزشکی ثبت نشده است.' : 'هنوز روانشناس یا مشاوری ثبت نشده است.';
}

function renderOneStaffList(type) {
    const container = document.getElementById(`settings-${type}-list`);
    if (!container) return;
    const list = window.staff[type] || [];
    const roleLabel = staffRoleLabel(type);

    if (list.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 font-medium py-3">${staffEmptyLabel(type)}</div>`;
    } else {
        container.innerHTML = list.map((name, idx) => {
            if (editingStaff.type === type && editingStaff.index === idx) {
                return `
                    <div class="flex justify-between items-center bg-white px-2 py-1.5 rounded-lg border border-teal-500 animate-fade-in gap-2">
                        <input type="text" id="input-edit-${type}-${idx}" class="flex-1 px-2 py-1 text-[11px] border rounded-lg outline-none focus:border-teal-brand" value="${escapeHTML(name)}">
                        <div class="flex gap-1 shrink-0">
                            <button onclick="saveStaffMember('${type}', ${idx})" class="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition" title="ذخیره">
                                <i class="fa-solid fa-check text-[10px]"></i>
                            </button>
                            <button onclick="cancelEditStaff()" class="p-1 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg transition" title="انصراف">
                                <i class="fa-solid fa-xmark text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="truncate" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
                        <span class="text-[10px] font-medium text-slate-400 shrink-0">${roleLabel}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">فعال</span>
                        <div class="flex gap-1.5">
                            <button onclick="startEditStaff('${type}', ${idx})" class="text-blue-500 hover:text-blue-700 transition" title="ویرایش">
                                <i class="fa-solid fa-pen text-[11px]"></i>
                            </button>
                            <button onclick="archiveStaffMember('${type}', ${idx})" class="text-amber-500 hover:text-amber-600 transition" title="بایگانی">
                                <i class="fa-solid fa-box-archive text-[11px]"></i>
                            </button>
                            <button onclick="removeStaffMember('${type}', ${idx})" class="text-red-500 hover:text-red-700 transition" title="حذف">
                                <i class="fa-solid fa-trash-can text-[11px]"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // بخش بایگانی‌شده‌ها
    const archivedList = window.staff[archivedKeyFor(type)] || [];
    const toggleBtn = document.getElementById(`settings-${type}-archived-toggle`);
    const archivedContainer = document.getElementById(`settings-${type}-archived-list`);
    if (toggleBtn) {
        if (archivedList.length === 0) {
            toggleBtn.classList.add('hidden');
        } else {
            toggleBtn.classList.remove('hidden');
            const arrow = staffArchivedVisible[type] ? 'fa-chevron-up' : 'fa-chevron-down';
            toggleBtn.innerHTML = `بایگانی‌شده‌ها (${toPersianDigits(archivedList.length)}) <i class="fa-solid ${arrow} text-[9px] mr-1"></i>`;
        }
    }
    if (archivedContainer) {
        if (staffArchivedVisible[type] && archivedList.length > 0) {
            archivedContainer.classList.remove('hidden');
            archivedContainer.innerHTML = archivedList.map((name, aIdx) => `
                <div class="flex justify-between items-center bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="truncate" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
                        <span class="text-[10px] font-medium text-slate-400 shrink-0">${roleLabel}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">بایگانی‌شده</span>
                        <div class="flex gap-1.5">
                            <button onclick="unarchiveStaffMember('${type}', ${aIdx})" class="text-teal-600 hover:text-teal-700 transition" title="بازگردانی">
                                <i class="fa-solid fa-rotate-left text-[11px]"></i>
                            </button>
                            <button onclick="removeStaffMember('${type}', ${aIdx}, true)" class="text-red-500 hover:text-red-700 transition" title="حذف">
                                <i class="fa-solid fa-trash-can text-[11px]"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            archivedContainer.classList.add('hidden');
            archivedContainer.innerHTML = '';
        }
    }
}

function renderStaffSettingsLists() {
    renderOneStaffList('doctors');
    renderOneStaffList('psychologists');
    bindDigitConverters(); // اتصال رویدادها به ورودی‌های داینامیک تنظیمات
}

function toggleArchivedStaff(type) {
    staffArchivedVisible[type] = !staffArchivedVisible[type];
    renderStaffSettingsLists();
}

function archiveStaffMember(type, index) {
    const memberName = window.staff[type][index];
    window.staff[type].splice(index, 1);
    window.staff[archivedKeyFor(type)].push(memberName);

    dbPutRecord('staff', { id: 'main', data: window.staff });
    triggerBackupReminder();

    applySettings();
    renderStaffSettingsLists();
    showToast(`"${memberName}" بایگانی شد.`);
}

function unarchiveStaffMember(type, index) {
    const aKey = archivedKeyFor(type);
    const memberName = window.staff[aKey][index];

    if (window.staff[type].includes(memberName)) {
        showCustomAlert("کادر درمانی تکراری", "این نام در حال حاضر در لیست فعال وجود دارد!");
        return;
    }

    window.staff[aKey].splice(index, 1);
    window.staff[type].push(memberName);

    dbPutRecord('staff', { id: 'main', data: window.staff });
    triggerBackupReminder();

    applySettings();
    renderStaffSettingsLists();
    showToast(`"${memberName}" بازگردانی شد.`);
}

function saveClinicSettings(event) {
    event.preventDefault();

    window.settings.clinicName = document.getElementById('setting-clinicName').value;
    window.settings.displayTitle = document.getElementById('setting-displayTitle').value;
    window.settings.managerName = document.getElementById('setting-managerName').value;
    window.settings.chiefDoctorName = document.getElementById('setting-chiefDoctorName').value;
    window.settings.city = document.getElementById('setting-city').value;
    window.settings.phone = document.getElementById('setting-phone').value;
    window.settings.mobile = document.getElementById('setting-mobile').value;
    window.settings.address = document.getElementById('setting-address').value;
    window.settings.description = document.getElementById('setting-description').value;

    dbPutRecord('settings', { id: 'main', data: window.settings });
    triggerBackupReminder();

    applySettings();
    showToast("مشخصات کلینیک با موفقیت ذخیره و در سربرگ سامانه اعمال شد.");
}

function addStaffMember(event, type) {
    event.preventDefault();
    const inputId = type === 'doctors' ? 'input-new-doctor' : 'input-new-psychologist';
    const inputVal = document.getElementById(inputId).value.trim();

    if (!inputVal) return;

    if (window.staff[type].includes(inputVal)) {
        showCustomAlert("کادر درمانی تکراری", "این نام قبلاً در سامانه ثبت شده است!");
        return;
    }

    window.staff[type].push(inputVal);

    dbPutRecord('staff', { id: 'main', data: window.staff });
    triggerBackupReminder();

    applySettings();

    document.getElementById(inputId).value = '';
    renderStaffSettingsLists();
    showToast("عضو جدید کادر درمان با موفقیت اضافه شد.");
}

function removeStaffMember(type, index, fromArchived) {
    const sourceKey = fromArchived ? archivedKeyFor(type) : type;
    const memberName = window.staff[sourceKey][index];
    showCustomConfirm(
        "حذف عضو کادر درمان",
        `آیا از حذف "${memberName}" از سامانه اطمینان دارید؟`,
        () => {
            window.staff[sourceKey].splice(index, 1);

            dbPutRecord('staff', { id: 'main', data: window.staff });
            triggerBackupReminder();

            applySettings();
            renderStaffSettingsLists();
            showToast("عضو کادر درمان با موفقیت حذف شد.");
        }
    );
}

