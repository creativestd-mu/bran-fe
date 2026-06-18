import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios"
import { trackRequestEnd, trackRequestStart } from "@/lib/networkActivity"
import type { MostVisitedPage } from "@/types"

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://localhost:4001"
const LANG = "en"
const NETWORK_TRACKED_KEY = "__networkTracked"

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  details?: unknown
}

export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

function asApiError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiResponse | undefined
    const message = body?.error || error.message || "Request failed"
    throw new ApiError(message, error.response?.status ?? 0, body?.details)
  }
  if (error instanceof Error) throw error
  throw new Error("Request failed")
}

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: `${BACKEND_BASE_URL}/${LANG}/v1`,
      headers: { "Content-Type": "application/json" },
    })

    this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      ;(config as InternalAxiosRequestConfig & Record<string, unknown>)[NETWORK_TRACKED_KEY] = true
      trackRequestStart()
      const token = localStorage.getItem("bran_token")
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    this.client.interceptors.response.use(
      (response) => {
        if ((response.config as InternalAxiosRequestConfig & Record<string, unknown>)[NETWORK_TRACKED_KEY]) {
          trackRequestEnd()
        }
        return response
      },
      (error: AxiosError<ApiResponse>) => {
        const config = error.config as (InternalAxiosRequestConfig & Record<string, unknown>) | undefined
        if (config?.[NETWORK_TRACKED_KEY]) {
          trackRequestEnd()
        }
        if (error.response?.status === 401) {
          localStorage.removeItem("bran_token")
          localStorage.removeItem("bran_user")
          localStorage.removeItem("bran_most_visited")
        }
        return Promise.reject(error)
      }
    )
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.client.get<ApiResponse<T>>(url, { params })
      if (!response.data.success) throw new ApiError(response.data.error || "Request failed", response.status, response.data.details)
      return response.data.data as T
    } catch (error) { asApiError(error) }
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data)
      if (!response.data.success) throw new ApiError(response.data.error || "Request failed", response.status, response.data.details)
      return response.data.data as T
    } catch (error) { asApiError(error) }
  }

  async postForm<T>(url: string, form: FormData): Promise<T> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, form, {
        headers: { "Content-Type": undefined },
      })
      if (!response.data.success) throw new ApiError(response.data.error || "Request failed", response.status, response.data.details)
      return response.data.data as T
    } catch (error) { asApiError(error) }
  }

  async putForm<T>(url: string, form: FormData): Promise<T> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, form, {
        headers: { "Content-Type": undefined },
      })
      if (!response.data.success) throw new ApiError(response.data.error || "Request failed", response.status, response.data.details)
      return response.data.data as T
    } catch (error) { asApiError(error) }
  }

  async downloadBlob(url: string): Promise<{ blob: Blob; filename: string }> {
    try {
      const response = await this.client.get(url, { responseType: "blob" })
      const disposition = response.headers["content-disposition"] as string | undefined
      let filename = "document"
      if (disposition) {
        const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition)
        if (match?.[1]) filename = decodeURIComponent(match[1].replace(/"/g, ""))
      }
      return { blob: response.data as Blob, filename }
    } catch (error) { asApiError(error) }
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data)
      if (!response.data.success) throw new ApiError(response.data.error || "Request failed", response.status, response.data.details)
      return response.data.data as T
    } catch (error) { asApiError(error) }
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await this.client.patch<ApiResponse<T>>(url, data)
      if (!response.data.success) throw new ApiError(response.data.error || "Request failed", response.status, response.data.details)
      return response.data.data as T
    } catch (error) { asApiError(error) }
  }

  async delete<T>(url: string): Promise<T> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url)
      if (!response.data.success) throw new ApiError(response.data.error || "Request failed", response.status, response.data.details)
      return response.data.data as T
    } catch (error) { asApiError(error) }
  }
}

export const api = new ApiClient()

export interface AuthLoginData {
  token: string
  user: { id: string; email: string; name: string; avatarUrl: string | null; role: string }
  mostVisitedPages: MostVisitedPage[]
}

export const authApi = {
  googleLogin: (idToken: string) => api.post<AuthLoginData>("/auth/google", { idToken }),
  login: (email: string, password: string) => api.post<AuthLoginData>("/auth/login", { email, password }),
}

export const navigationApi = {
  logSearch: (data: { query: string; selectedPath?: string }) =>
    api.post<{ id: string; query: string; selectedPath: string | null; createdAt: string }>(
      "/navigation/search-logs",
      data
    ),
  recordPageVisit: (data: { path: string }) =>
    api.post<MostVisitedPage>("/navigation/page-visits", data),
  listPageVisits: () => api.get<MostVisitedPage[]>("/navigation/page-visits"),
}

export const usersApi = {
  me: () => api.get<import("@/types").User>("/users/me"),
  list: (params?: { page?: number; pageSize?: number; roleId?: string; isActive?: boolean }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").User>>("/users", params as Record<string, unknown>),
  create: (data: {
    email: string
    name: string
    roleId: string
    description?: string
    phone?: string
    designation?: string
    isActive?: boolean
  }) => api.post<import("@/types").User>("/users", data),
  getById: (id: string) => api.get<import("@/types").User>(`/users/${id}`),
  update: (id: string, data: Partial<{ name: string; description: string; phone: string; designation: string; roleId: string; isActive: boolean }>) =>
    api.put<import("@/types").User>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  getSocialAccounts: (id: string) => api.get<import("@/types").SocialAccount[]>(`/users/${id}/social-accounts`),
  addSocialAccount: (id: string, data: { platform: string; platformAccountId: string; handle?: string }) =>
    api.post<import("@/types").SocialAccount>(`/users/${id}/social-accounts`, data),
  deleteSocialAccount: (accountId: string) => api.delete(`/users/social-accounts/${accountId}`),
}

export const rolesApi = {
  list: () => api.get<import("@/types").Role[]>("/roles"),
  getById: (id: string) => api.get<import("@/types").Role>(`/roles/${id}`),
  create: (data: { name: string; description?: string }) => api.post<import("@/types").Role>("/roles", data),
  update: (id: string, data: { name?: string; description?: string }) => api.put<import("@/types").Role>(`/roles/${id}`, data),
  delete: (id: string) => api.delete(`/roles/${id}`),
  updatePermissions: (id: string, permissionIds: string[]) => api.put(`/roles/${id}/permissions`, { permissionIds }),
  getAllPermissions: () => api.get<import("@/types").Permission[]>("/roles/permissions/all"),
  createPermission: (data: { name: string; description?: string }) => api.post<import("@/types").Permission>("/roles/permissions", data),
  deletePermission: (id: string) => api.delete(`/roles/permissions/${id}`),
}

export const verticalsApi = {
  list: () => api.get<import("@/types").Vertical[]>("/verticals"),
  getById: (id: string) => api.get<import("@/types").Vertical>(`/verticals/${id}`),
}

export const teamsApi = {
  list: () => api.get<import("@/types").Team[]>("/teams"),
  getById: (id: string) => api.get<import("@/types").Team>(`/teams/${id}`),
  create: (data: { name: string; description?: string; verticalId?: string }) =>
    api.post<import("@/types").Team>("/teams", data),
  upsertHierarchy: (data: {
    teamId?: string
    name: string
    description?: string
    members: Array<{
      userId: string
      memberRole: import("@/types").MemberRole
      reportsToUserId: string | null
    }>
  }) => api.post<import("@/types").Team>("/teams/hierarchy", data),
  update: (id: string, data: { name?: string; description?: string; verticalId?: string | null }) =>
    api.put<import("@/types").Team>(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  addMember: (teamId: string, data: import("@/types").HierarchyMemberPayload) =>
    api.post<import("@/types").HierarchyMember>(`/teams/${teamId}/members`, data),
  updateMember: (memberId: string, data: Partial<import("@/types").HierarchyMemberPayload>) =>
    api.put<import("@/types").HierarchyMember>(`/teams/members/${memberId}`, data),
  deleteMember: (memberId: string) => api.delete(`/teams/members/${memberId}`),
}

export const projectsApi = {
  list: () => api.get<import("@/types").Project[]>("/projects"),
  getById: (id: string) => api.get<import("@/types").Project>(`/projects/${id}`),
  create: (data: { name: string; description?: string; verticalId?: string }) =>
    api.post<import("@/types").Project>("/projects", data),
  upsertHierarchy: (data: {
    projectId?: string
    name: string
    description?: string
    members: Array<{
      userId: string
      memberRole: import("@/types").MemberRole
      reportsToUserId: string | null
    }>
  }) => api.post<import("@/types").Project>("/projects/hierarchy", data),
  update: (id: string, data: { name?: string; description?: string; verticalId?: string | null }) =>
    api.put<import("@/types").Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (projectId: string, data: import("@/types").HierarchyMemberPayload) =>
    api.post<import("@/types").HierarchyMember>(`/projects/${projectId}/members`, data),
  updateMember: (memberId: string, data: Partial<import("@/types").HierarchyMemberPayload>) =>
    api.put<import("@/types").HierarchyMember>(`/projects/members/${memberId}`, data),
  deleteMember: (memberId: string) => api.delete(`/projects/members/${memberId}`),
}

export const adhocWorkApi = {
  create: (data: {
    description: string
    output?: string
    effortHours?: number
  }) => api.post<import("@/types").AdhocWorkEntry>("/adhoc-work", data),
  list: (params?: {
    userId?: string
    from?: string
    to?: string
    page?: number
    pageSize?: number
  }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").AdhocWorkEntry>>(
      "/adhoc-work",
      params as Record<string, unknown>
    ),
  getById: (id: string) => api.get<import("@/types").AdhocWorkEntry>(`/adhoc-work/${id}`),
  update: (
    id: string,
    data: Partial<{
      description: string
      output: string | null
      effortHours: number | null
    }>
  ) => api.put<import("@/types").AdhocWorkEntry>(`/adhoc-work/${id}`, data),
  delete: (id: string) => api.delete(`/adhoc-work/${id}`),
}

export const workApi = {
  createAudio: (file: Blob, filename: string) => {
    const form = new FormData()
    form.append("file", file, filename)
    return api.postForm<import("@/types").AudioWorkResult>("/work/audio", form)
  },
  regenerateFromTranscript: (transcript: string) =>
    api.post<import("@/types").AudioWorkResult>("/work/transcript", { transcript }),
  create: (data: {
    title: string
    context: string
    status?: import("@/types").WorkUnitStatus
    isPrivate?: boolean
    steps?: Array<{
      description: string
      deadline?: string | null
      done?: boolean
    }>
  }) => api.post<import("@/types").WorkUnit>("/work", data),
  list: (params?: {
    userId?: string
    status?: import("@/types").WorkUnitStatus
    from?: string
    to?: string
    page?: number
    pageSize?: number
  }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").WorkUnit>>(
      "/work",
      params as Record<string, unknown>
    ),
  deadlines: (date?: string) =>
    api.get<import("@/types").DeadlinesResult>("/work/deadlines", date ? { date } : undefined),
  getById: (id: string) => api.get<import("@/types").WorkUnit>(`/work/${id}`),
  update: (
    id: string,
    data: Partial<{
      title: string
      context: string
      status: import("@/types").WorkUnitStatus
      isPrivate: boolean
      steps: Array<{
        description: string
        deadline?: string | null
        done?: boolean
      }>
    }>
  ) => api.put<import("@/types").WorkUnit>(`/work/${id}`, data),
  delete: (id: string) => api.delete(`/work/${id}`),
}

export const tasksApi = {
  create: (data: {
    title: string
    description?: string
    type?: import("@/types").TaskType
    platform?: import("@/types").TaskPlatform
    contentUrl?: string
    metadata?: string
    dueDate?: string
  }) => api.post<import("@/types").Task>("/tasks", data),
  list: (params?: {
    userId?: string
    status?: string
    type?: string
    platform?: string
    from?: string
    to?: string
    page?: number
    pageSize?: number
  }) => api.get<import("@/types").PaginatedResponse<import("@/types").Task>>("/tasks", params as Record<string, unknown>),
  getById: (id: string) => api.get<import("@/types").Task>(`/tasks/${id}`),
  update: (id: string, data: Partial<{
    title: string
    description: string
    type: import("@/types").TaskType
    platform: import("@/types").TaskPlatform
    contentUrl: string
    status: import("@/types").TaskStatus
    metadata: string
    dueDate: string
  }>) => api.put<import("@/types").Task>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
}

export const aiApi = {
  query: (query: string) => api.post<import("@/types").AIQueryResponse>("/ai/query", { query }),
  listQueries: (params?: { page?: number; pageSize?: number }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").AIQueryHistoryItem>>(
      "/ai/queries",
      params as Record<string, unknown>
    ),
  getQueryById: (id: string) => api.get<import("@/types").AIQueryHistoryItem>(`/ai/queries/${id}`),
}

export const visionsApi = {
  list: (params?: {
    horizon?: import("@/types").VisionHorizon
    scope?: import("@/types").VisionScope
    teamId?: string
    userId?: string
    page?: number
    pageSize?: number
  }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").Vision>>(
      "/visions",
      params as Record<string, unknown>
    ),
  getById: (id: string) => api.get<import("@/types").Vision>(`/visions/${id}`),
  create: (form: FormData) => api.postForm<import("@/types").Vision>("/visions", form),
  update: (id: string, form: FormData) => api.putForm<import("@/types").Vision>(`/visions/${id}`, form),
  delete: (id: string) => api.delete(`/visions/${id}`),
  downloadDocument: (id: string) => api.downloadBlob(`/visions/${id}/document`),
}

export const kpisApi = {
  list: (params?: {
    userId?: string
    isActive?: boolean
    isKey?: boolean
    page?: number
    pageSize?: number
  }) =>
    api.get<import("@/types").PaginatedResponse<import("@/types").KPI>>(
      "/kpis",
      params as Record<string, unknown>
    ),
  getById: (id: string) => api.get<import("@/types").KPI>(`/kpis/${id}`),
  create: (data: {
    userId: string
    title: string
    description?: string
    sortOrder?: number
    isActive?: boolean
    isKey?: boolean
  }) => api.post<import("@/types").KPI>("/kpis", data),
  batch: (data: {
    userId: string
    items: Array<{
      title: string
      description?: string
      sortOrder?: number
      isActive?: boolean
      isKey?: boolean
    }>
  }) => api.post<import("@/types").KPI[]>("/kpis/batch", data),
  update: (
    id: string,
    data: Partial<{
      title: string
      description: string
      sortOrder: number
      isActive: boolean
      isKey: boolean
    }>
  ) => api.put<import("@/types").KPI>(`/kpis/${id}`, data),
  delete: (id: string) => api.delete(`/kpis/${id}`),
}

export const contentsApi = {
  list: (params?: {
    type?: import("@/types").ContentType
    status?: import("@/types").ContentStatus
    mine?: boolean
    teamId?: string
    projectId?: string
    verticalId?: string
  }) => api.get<import("@/types").Content[]>("/contents", params as Record<string, unknown>),
  getById: (id: string) => api.get<import("@/types").Content>(`/contents/${id}`),
  create: (data: {
    title: string
    description?: string
    type: import("@/types").ContentType
    status?: import("@/types").ContentStatus
    teamId: string
    projectId: string
  }) => api.post<import("@/types").Content>("/contents", data),
  update: (
    id: string,
    data: Partial<{
      title: string
      description: string | null
      type: import("@/types").ContentType
      status: import("@/types").ContentStatus
      teamId: string
      projectId: string
    }>
  ) => api.put<import("@/types").Content>(`/contents/${id}`, data),
  delete: (id: string) => api.delete(`/contents/${id}`),

  // nodes
  createNode: (
    contentId: string,
    data: {
      kind: import("@/types").NodeKind
      name: string
      orderIndex?: number
      notes?: string
      startsAt?: string
      dueDate?: string
    }
  ) => api.post<import("@/types").ContentNode>(`/contents/${contentId}/nodes`, data),
  updateNode: (
    nodeId: string,
    data: Partial<{
      kind: import("@/types").NodeKind
      name: string
      orderIndex: number
      notes: string | null
      startsAt: string | null
      dueDate: string | null
    }>
  ) => api.put<import("@/types").ContentNode>(`/contents/nodes/${nodeId}`, data),
  setNodeStatus: (nodeId: string, status: import("@/types").NodeStatus) =>
    api.patch<import("@/types").ContentNode>(`/contents/nodes/${nodeId}/status`, { status }),
  deleteNode: (nodeId: string) => api.delete(`/contents/nodes/${nodeId}`),

  // team
  addTeamMember: (
    nodeId: string,
    data: { userId: string; role: import("@/types").TeamRole }
  ) => api.post<import("@/types").ContentNodeTeamMember>(`/contents/nodes/${nodeId}/team`, data),
  removeTeamMember: (teamMemberId: string) => api.delete(`/contents/team/${teamMemberId}`),

  // outputs
  createOutput: (
    nodeId: string,
    data: { label: string; url: string; notes?: string }
  ) => api.post<import("@/types").ContentNodeOutput>(`/contents/nodes/${nodeId}/outputs`, data),
  updateOutput: (
    outputId: string,
    data: Partial<{ label: string; url: string; notes: string | null }>
  ) => api.put<import("@/types").ContentNodeOutput>(`/contents/outputs/${outputId}`, data),
  deleteOutput: (outputId: string) => api.delete(`/contents/outputs/${outputId}`),
  reviewOutput: (
    outputId: string,
    data: { approvalState: import("@/types").ApprovalState; reviewNote?: string | null }
  ) => api.post<import("@/types").ContentNodeOutput>(`/contents/outputs/${outputId}/review`, data),

  // resources
  createResource: (
    nodeId: string,
    data: {
      name: string
      sourceType?: import("@/types").ResourceSourceType
      cost?: number
      quantity?: number
      currency?: string
      notes?: string
    }
  ) => api.post<import("@/types").ContentNodeResource>(`/contents/nodes/${nodeId}/resources`, data),
  updateResource: (
    resourceId: string,
    data: Partial<{
      name: string
      sourceType: import("@/types").ResourceSourceType
      cost: number | null
      quantity: number
      currency: string | null
      notes: string | null
    }>
  ) => api.put<import("@/types").ContentNodeResource>(`/contents/resources/${resourceId}`, data),
  deleteResource: (resourceId: string) => api.delete(`/contents/resources/${resourceId}`),
  reviewResource: (
    resourceId: string,
    data: { approvalState: "APPROVED" | "REJECTED"; reviewNote?: string | null }
  ) => api.post<import("@/types").ContentNodeResource>(`/contents/resources/${resourceId}/review`, data),
}

export const notificationsApi = {
  list: (params?: { unreadOnly?: boolean; take?: number; skip?: number }) =>
    api.get<import("@/types").NotificationsPage>("/notifications", {
      unreadOnly: params?.unreadOnly ? "true" : undefined,
      take: params?.take,
      skip: params?.skip,
    }),
  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),
  markRead: (id: string) =>
    api.patch<{ id: string; readAt: string }>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ updated: number }>("/notifications/read-all"),
}

export const socialApi = {
  getStats: (platform: string, accountId: string) =>
    api.get<import("@/types").SocialStats>(`/social-api/${platform}/${accountId}/stats`),
  getContent: (platform: string, accountId: string, limit = 10) =>
    api.get<import("@/types").SocialContent>(`/social-api/${platform}/${accountId}/content`, { limit }),
  getContentStats: (platform: string, contentId: string) =>
    api.get<import("@/types").SocialContentItem>(`/social-api/${platform}/content/${contentId}/stats`),
}

export const ideationApi = {
  createIdea: (data: import("@/types").CreateIdeaRequest) =>
    api.post<import("@/types").IdeaItem>("/ideation/ideas", data),
  listMyIdeas: (params?: { take?: number; skip?: number }) =>
    api.get<import("@/types").IdeaItem[]>("/ideation/ideas/me", params as Record<string, unknown>),
  listMyRecommendations: (params?: { take?: number; skip?: number }) =>
    api.get<import("@/types").RecommendationItem[]>(
      "/ideation/recommendations/me",
      params as Record<string, unknown>
    ),
}
