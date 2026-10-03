import { http } from "../../../api/http";
export type Attachment = { id: string; fileName: string; contentType: string; length: number; uploadedBy: string; uploadedAtUtc: string };
export type AuditEntry = { id: string; action: string; userId: string; userName?:string; createdAt: string; detailsJson?: string };
const root = (company: string, id: string,type="requisition") => `/companies/${company}/procurement/documents/${type}/${id}`;
export const procurementDocumentsApi = {
  list: async (company: string, id: string,type="requisition") => (await http.get<Attachment[]>(`${root(company,id,type)}/attachments`)).data,
  audit: async (company: string, id: string,type="requisition") => (await http.get<AuditEntry[]>(`${root(company,id,type)}/audit`)).data,
  upload: async (company: string, id: string, file: File,type="requisition") => {
    const body = new FormData(); body.append("file",file);
    return (await http.post<Attachment>(`${root(company,id,type)}/attachments`,body)).data;
  },
  download: async (company: string, id: string, file: Attachment,type="requisition") => {
    const response = await http.get<Blob>(`${root(company,id,type)}/attachments/${file.id}`,{responseType:"blob"});
    const url=URL.createObjectURL(response.data); const anchor=document.createElement("a");
    anchor.href=url; anchor.download=file.fileName; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
};
