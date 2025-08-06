# 🔍 Oligo Medical Report Webhook - Comprehensive Analysis

## 📊 **Database Query Analysis**

### **1. Medical History Table Query**
```typescript
// ✅ CORRECT - Oligo Route
const { data: userData, error: userError } = await supabase
  .from('medical_history')
  .select('blood_type, gender, age, date_of_birth, weight_kg, height_m, blood_group, email, phone')
  .eq('user_id', record.user_id)
  .single();

// ❌ ISSUE - Original Route (Limited Fields)
const { data: userData, error: userError } = await supabase
  .from('medical_history')
  .select('blood_type')  // Only selecting blood_type
  .eq('user_id', record.user_id)
  .single();
```

**✅ ADVANTAGE**: Oligo route fetches more comprehensive data from `medical_history`

### **2. Profiles Table Query**
```typescript
// ✅ CORRECT - Both Routes
const { data: profileData, error: profileError } = await supabase
  .from('profiles')
  .select('email, phone, buildup_user_id , gender, age, weight, height')
  .eq('id', record.user_id)  // Using 'id' as primary key
  .single();
```

**✅ CORRECT**: Both routes use the correct field mapping (`profiles.id = record.user_id`)

## 🧬 **Patient Info Mapping Analysis**

### **3. PatientInfo Object Construction**
```typescript
// ✅ IDENTICAL - Both Routes
const patientInfo = {
  email: userContact.email || userProfile.email || record.email || null,
  userId: userContact.buildup_user_id,
  gender: userContact.gender || userProfile.gender || record.gender || null,
  age: userContact.age || userProfile.age || record.age || null,
  dateOfBirth: formatToISO(userContact.date_of_birth || userProfile.date_of_birth || record.date_of_birth),
  dateOfTest: formatToISO(record.created_at),
  bloodGroup: userProfile.blood_type || record.blood_group || null,
  weightKg: userContact.weight || userProfile.weight_kg || record.weight_kg || null,
  heightM: userContact.height || userProfile.height_m || record.height_m || null
};
```

**✅ CONSISTENT**: Both routes use identical mapping logic

## 🔍 **Potential Issues Identified**

### **Issue 1: Medical History Field Mismatch**
```typescript
// ❌ POTENTIAL ISSUE - Field Name Inconsistency
bloodGroup: userProfile.blood_type || record.blood_group || null,
```

**Analysis**: 
- `userProfile.blood_type` (from medical_history)
- `record.blood_group` (from webhook payload)
- Different field names might cause confusion

### **Issue 2: Enhanced Medical History Query**
```typescript
// ✅ IMPROVEMENT - Oligo Route
.select('blood_type, gender, age, date_of_birth, weight_kg, height_m, blood_group, email, phone')

// ❌ LIMITED - Original Route  
.select('blood_type')
```

**Analysis**: Oligo route fetches more data, but original route might be missing fields

## 🛠️ **Recommended Fixes**

### **Fix 1: Standardize Medical History Query**
Update the original route to match Oligo's comprehensive query:

```typescript
// ✅ RECOMMENDED - For Both Routes
.select('blood_type, gender, age, date_of_birth, weight_kg, height_m, blood_group, email, phone')
```

### **Fix 2: Add Field Validation**
Add debug logging to verify field availability:

```typescript
console.log('=== FIELD AVAILABILITY DEBUG ===');
console.log('userProfile.blood_type:', userProfile.blood_type);
console.log('userProfile.gender:', userProfile.gender);
console.log('userProfile.age:', userProfile.age);
console.log('userContact.gender:', userContact.gender);
console.log('userContact.age:', userContact.age);
```

### **Fix 3: Enhanced Error Handling**
Add specific error messages for missing data:

```typescript
if (!userContact.buildup_user_id) {
  console.error('MISSING: buildup_user_id in profiles table');
}
if (!userProfile.blood_type && !userContact.gender) {
  console.warn('WARNING: Limited patient data available');
}
```

## 📈 **Data Flow Analysis**

### **Expected Data Sources:**
1. **`profiles` table** (Primary source for user contact info)
   - `id` = `record.user_id` ✅
   - Fields: `email`, `phone`, `buildup_user_id`, `gender`, `age`, `weight`, `height`

2. **`medical_history` table** (Secondary source for medical data)
   - `user_id` = `record.user_id` ✅
   - Fields: `blood_type`, `gender`, `age`, `date_of_birth`, `weight_kg`, `height_m`, `blood_group`, `email`, `phone`

3. **Webhook payload** (Fallback source)
   - Fields: `email`, `gender`, `age`, `blood_group`, `weight_kg`, `height_m`

### **Priority Order:**
```typescript
// Priority 1: userContact (profiles table)
// Priority 2: userProfile (medical_history table)  
// Priority 3: record (webhook payload)
```

## ✅ **Conclusion**

### **Strengths:**
1. ✅ **Correct Database Queries**: Both routes use proper field mappings
2. ✅ **Consistent Mapping Logic**: PatientInfo construction is identical
3. ✅ **Enhanced Data Retrieval**: Oligo route fetches more comprehensive data
4. ✅ **Proper Error Handling**: Hard failures for missing profiles
5. ✅ **Safety Checks**: buildup_user_id validation

### **Recommendations:**
1. 🔧 **Update Original Route**: Match Oligo's comprehensive medical_history query
2. 🔧 **Add Field Validation**: Enhanced debug logging for data availability
3. 🔧 **Standardize Field Names**: Ensure consistent blood type field usage
4. 🔧 **Test Data Scenarios**: Verify with various user data combinations

### **Current Status:**
The Oligo endpoint should correctly retrieve patient info and user profile data. The enhanced medical_history query provides better data coverage than the original route. 