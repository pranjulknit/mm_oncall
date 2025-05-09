const admin = require("firebase-admin");
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function getUserById(userId) {
  const doc = await db.collection("users").doc(String(userId)).get();
  return doc.exists ? doc.data() : null;
}

async function setAdmin(telegramId, phoneNumber, fullName) {
  const userRef = db.collection("users").doc(String(telegramId));
  const user = await userRef.get();
  let roles = user.exists ? user.data().roles || [] : [];
  if (!roles.includes("admin")) {
    roles.push("admin");
  }
  await userRef.set({
    telegram_id: telegramId,
    phone_number: phoneNumber,
    full_name: fullName,
    roles,
    team: null,
    verified: true,
    created_at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function setLead(telegramId, phoneNumber, fullName, team) {
  const userRef = db.collection("users").doc(String(telegramId));
  const user = await userRef.get();
  let roles = user.exists ? user.data().roles || [] : [];
  if (!roles.includes("lead")) {
    roles.push("lead");
  }
  await userRef.set({
    telegram_id: telegramId,
    phone_number: phoneNumber,
    full_name: fullName,
    roles,
    team,
    verified: true,
    created_at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function addUser(telegramId, phoneNumber, fullName, team) {
  const userRef = db.collection("users").doc(String(telegramId));
  const user = await userRef.get();
  let roles = user.exists ? user.data().roles || [] : [];
  if (!roles.includes("user")) {
    roles.push("user");
  }
  await userRef.set({
    telegram_id: telegramId,
    phone_number: phoneNumber,
    full_name: fullName,
    roles,
    team,
    verified: true,
    created_at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function isAdmin(userId) {
  const user = await getUserById(userId);
  return user && user.roles && user.roles.includes("admin");
}

async function isLead(userId) {
  const user = await getUserById(userId);
  return user && user.roles && user.roles.includes("lead");
}

async function getTeamMembers(team) {
  const snapshot = await db.collection("users").where("team", "==", team).get();
  return snapshot.docs.map(doc => ({
    telegram_id: doc.data().telegram_id,
    full_name: doc.data().full_name
  }));
}

async function getTeamMembersWithRoles(team) {
  const snapshot = await db.collection("users").where("team", "==", team).get();
  return snapshot.docs.map(doc => doc.data());
}

async function setRoster(team, date, primaryId, secondaryId) {
  await db.collection("roster").doc(`${team}_${date}`).set({
    team,
    date,
    primary_id: primaryId,
    secondary_id: secondaryId,
    created_at: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function getRoster(team, date) {
  const doc = await db.collection("roster").doc(`${team}_${date}`).get();
  return doc.exists ? doc.data() : null;
}

async function getTeamRoster(team) {
  const snapshot = await db.collection("roster").where("team", "==", team).get();
  return snapshot.docs.map(doc => doc.data());
}

async function notifyAdminsLeads(userId, username) {
  const snapshot = await db.collection("users").where("roles", "array-contains-any", ["admin", "lead"]).get();
  return snapshot.docs.map(doc => doc.data().telegram_id);
}

async function createCriticalIncident(team, issue, primaryId, secondaryId, leadId, chatId) {
  const docRef = await db.collection("critical_incidents").add({
    team,
    issue,
    primary_id: primaryId,
    secondary_id: secondaryId,
    lead_id: leadId,
    chat_id: String(chatId),
    status: "pending",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    primary_notified_at: admin.firestore.FieldValue.serverTimestamp(),
    primary_responded: false
  });
  return docRef.id;
}

async function checkIncidentResponse(incidentId) {
  const doc = await db.collection("critical_incidents").doc(incidentId).get();
  return doc.exists ? doc.data() : null;
}

async function markIncidentResponded(incidentId) {
  await db.collection("critical_incidents").doc(incidentId).update({
    status: "responded",
    primary_responded: true,
    responded_at: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function escalateIncident(incidentId) {
  await db.collection("critical_incidents").doc(incidentId).update({
    status: "escalated",
    secondary_notified_at: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function getLeadByTeam(team) {
  const snapshot = await db.collection("users").where("team", "==", team).where("roles", "array-contains", "lead").get();
  return snapshot.empty ? null : snapshot.docs[0].data();
}

module.exports = {
  getUserById,
  setAdmin,
  setLead,
  addUser,
  isAdmin,
  isLead,
  getTeamMembers,
  getTeamMembersWithRoles,
  setRoster,
  getRoster,
  getTeamRoster,
  notifyAdminsLeads,
  createCriticalIncident,
  checkIncidentResponse,
  markIncidentResponded,
  escalateIncident,
  getLeadByTeam
};