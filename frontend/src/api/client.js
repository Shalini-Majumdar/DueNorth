import axios from "axios";

import { API_BASE } from "../utils/constants";

const client = axios.create({
  baseURL: API_BASE || "/",
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
});

export const api = {
  getConfig: () => client.get("/api/config").then((r) => r.data),
  getOverdue: () => client.get("/api/invoices/overdue").then((r) => r.data),
  getLift: () => client.get("/api/lift").then((r) => r.data),
  calcInterest: (body) =>
    client.post("/api/interest/calculate", body).then((r) => r.data),
  getHumanReview: () => client.get("/api/human-review").then((r) => r.data),
  reviewAction: (id, action) =>
    client.post(`/api/human-review/${id}/action`, { action }).then((r) => r.data),
  runDunning: () => client.post("/api/dunning/run").then((r) => r.data),
  getAuditLog: (params) =>
    client.get("/api/audit-log", { params }).then((r) => r.data),
  getFaq: () => client.get("/api/faq").then((r) => r.data),
  onboard: (body) => client.post("/api/onboard", body).then((r) => r.data),
  getSupplier: () => client.get("/api/supplier").then((r) => r.data),
  prefillDemand: (body) =>
    client.post("/api/escalation/prefill", body).then((r) => r.data),
  ingest: (file) => {
    const form = new FormData();
    form.append("file", file);
    return client
      .post("/api/ingest", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};

export default client;
