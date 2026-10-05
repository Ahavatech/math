import { Role } from "@prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  HOD: "HOD",
  ADMIN: "Admin",
  LECTURER: "Lecturer",
  JOURNAL_EDITOR_IN_CHIEF: "Journal editor-in-chief",
  JOURNAL_EDITOR: "Journal editor",
  REVIEWER: "Journal reviewer",
  AUTHOR: "Journal author",
};

export function RoleCheckboxes({ defaultRoles = [] }: { defaultRoles?: Role[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.values(Role).map((role) => (
        <label key={role} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="roles"
            value={role}
            defaultChecked={defaultRoles.includes(role)}
          />
          {ROLE_LABELS[role]}
        </label>
      ))}
    </div>
  );
}
