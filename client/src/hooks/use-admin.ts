import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "user" | "admin";
  createdAt: string;
}

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "user" | "admin" }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });
}
