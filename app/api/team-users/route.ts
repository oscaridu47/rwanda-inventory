import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmployeeRole = "manager" | "staff" | "worker";

type BusinessMember = {
  id: string;
  business_id: string;
  user_id: string;
  role: "owner" | EmployeeRole;
  permissions: string[] | null;
  active: boolean | null;
  created_at?: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
};

const ALLOWED_PERMISSIONS = [
  "dashboard.view",
  "products.view",
  "products.create",
  "products.edit",
  "products.delete",
  "stock.view",
  "stock.receive",
  "stock.adjust",
  "stock.history",
  "sales.view",
  "sales.create",
  "sales.history",
  "reports.view",
  "expenses.view",
  "expenses.create",
  "expenses.delete",
  "accounts.view",
  "accounts.create",
  "accounts.manage",
  "settings.manage",
] as const;

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing Supabase URL.");
}

if (!supabasePublishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  );
}

if (!supabaseSecretKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY.");
}

const supabaseAuth = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

function getBearerToken(
  request: NextRequest
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] =
    authorization.split(" ");

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
}

async function getLoggedInUser(
  request: NextRequest
) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      user: null,
      response: errorResponse(
        "Authentication required.",
        401
      ),
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      response: errorResponse(
        "Invalid or expired authentication token.",
        401
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

async function getOwnerMembership(
  userId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("business_members")
    .select(
      "id,business_id,user_id,role,permissions,active,created_at"
    )
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load owner membership: ${error.message}`
    );
  }

  return data as BusinessMember | null;
}

async function verifyBusinessIsActive(
  businessId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("businesses")
    .select("id,name,status")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load business: ${error.message}`
    );
  }

  if (!data) {
    return {
      business: null,
      error: "Business not found.",
    };
  }

  if (data.status !== "active") {
    return {
      business: data,
      error:
        "This business is not active. Employee accounts cannot be managed yet.",
    };
  }

  return {
    business: data,
    error: null,
  };
}

function isEmployeeRole(
  value: unknown
): value is EmployeeRole {
  return (
    value === "manager" ||
    value === "staff" ||
    value === "worker"
  );
}

function cleanPermissions(
  permissions: unknown
): string[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return Array.from(
    new Set(
      permissions.filter(
        (permission): permission is string =>
          typeof permission === "string" &&
          (
            ALLOWED_PERMISSIONS as readonly string[]
          ).includes(permission)
      )
    )
  );
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function validUsername(username: string) {
  return /^[a-z0-9._-]{3,32}$/.test(
    username
  );
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function employeeToResponse(
  member: BusinessMember,
  profile: Profile | null
) {
  return {
    id: member.id,
    userId: member.user_id,
    businessId: member.business_id,
    role: member.role,
    active: member.active ?? true,
    permissions: cleanPermissions(
      member.permissions
    ),
    name: profile?.full_name ?? "",
    username: profile?.username ?? "",
    email: profile?.email ?? "",
    createdAt: member.created_at ?? "",
  };
}

/* =========================================================
   GET
   List employees belonging to the owner's business
   ========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const {
      user,
      response,
    } = await getLoggedInUser(request);

    if (response) {
      return response;
    }

    if (!user) {
      return errorResponse(
        "Authentication required.",
        401
      );
    }

    const ownerMembership =
      await getOwnerMembership(user.id);

    if (!ownerMembership) {
      return errorResponse(
        "Only a business owner can manage team accounts.",
        403
      );
    }

    const businessCheck =
      await verifyBusinessIsActive(
        ownerMembership.business_id
      );

    if (businessCheck.error) {
      return errorResponse(
        businessCheck.error,
        403
      );
    }

    const {
      data: members,
      error: membersError,
    } = await supabaseAdmin
      .from("business_members")
      .select(
        "id,business_id,user_id,role,permissions,active,created_at"
      )
      .eq(
        "business_id",
        ownerMembership.business_id
      )
      .neq("role", "owner")
      .order("created_at", {
        ascending: true,
      });

    if (membersError) {
      return errorResponse(
        membersError.message,
        500
      );
    }

    const memberRows =
      (members ?? []) as BusinessMember[];

    const userIds = memberRows.map(
      (member) => member.user_id
    );

    let profiles: Profile[] = [];

    if (userIds.length > 0) {
      const {
        data,
        error: profilesError,
      } = await supabaseAdmin
        .from("profiles")
        .select(
          "id,full_name,username,email"
        )
        .in("id", userIds);

      if (profilesError) {
        return errorResponse(
          profilesError.message,
          500
        );
      }

      profiles = (data ??
        []) as Profile[];
    }

    const profileMap =
      new Map<string, Profile>();

    for (const profile of profiles) {
      profileMap.set(profile.id, profile);
    }

    const employees = memberRows.map(
      (member) =>
        employeeToResponse(
          member,
          profileMap.get(member.user_id) ??
            null
        )
    );

    return NextResponse.json({
      success: true,
      employees,
    });
  } catch (error) {
    console.error(
      "GET /api/team-users error:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unexpected server error.",
      500
    );
  }
}

/* =========================================================
   POST
   Create a new employee account
   ========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    const {
      user,
      response,
    } = await getLoggedInUser(request);

    if (response) {
      return response;
    }

    if (!user) {
      return errorResponse(
        "Authentication required.",
        401
      );
    }

    const ownerMembership =
      await getOwnerMembership(user.id);

    if (!ownerMembership) {
      return errorResponse(
        "Only a business owner can create team accounts.",
        403
      );
    }

    const businessCheck =
      await verifyBusinessIsActive(
        ownerMembership.business_id
      );

    if (businessCheck.error) {
      return errorResponse(
        businessCheck.error,
        403
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Invalid JSON request body.",
        400
      );
    }

    /*
     * The accounts page sends "name".
     * We accept "name" as the official field.
     */
    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const username =
      typeof body.username === "string"
        ? body.username
            .trim()
            .toLowerCase()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const role = body.role;

    const requestedBusinessId =
      typeof body.businessId === "string"
        ? body.businessId
        : ownerMembership.business_id;

    const permissions =
      cleanPermissions(body.permissions);

    if (!name) {
      return errorResponse(
        "Employee name is required.",
        400
      );
    }

    if (!validUsername(username)) {
      return errorResponse(
        "Username must contain 3-32 lowercase letters, numbers, dots, underscores, or hyphens.",
        400
      );
    }

    if (!validEmail(email)) {
      return errorResponse(
        "A valid email address is required.",
        400
      );
    }

    if (password.length < 6) {
      return errorResponse(
        "Password must be at least 6 characters.",
        400
      );
    }

    if (!isEmployeeRole(role)) {
      return errorResponse(
        "Role must be manager, staff, or worker.",
        400
      );
    }

    if (
      requestedBusinessId !==
      ownerMembership.business_id
    ) {
      return errorResponse(
        "You can only create employees for your own business.",
        403
      );
    }

    const {
      data: existingUsername,
      error: usernameError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (usernameError) {
      return errorResponse(
        usernameError.message,
        500
      );
    }

    if (existingUsername) {
      return errorResponse(
        "That username is already in use.",
        409
      );
    }

    /*
     * Create the Supabase Auth account.
     * This is intentionally server-side.
     */
    const {
      data: createdAuth,
      error: createAuthError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          name,
          username,
          role,
          business_id:
            ownerMembership.business_id,
        },
      });

    if (
      createAuthError ||
      !createdAuth.user
    ) {
      return errorResponse(
        createAuthError?.message ??
          "Failed to create employee authentication account.",
        400
      );
    }

    const employeeUserId =
      createdAuth.user.id;

    /*
     * Create/update the application profile.
     */
    const {
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: employeeUserId,
          full_name: name,
          username,
          email,
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(
        employeeUserId
      );

      return errorResponse(
        `Failed to create employee profile: ${profileError.message}`,
        500
      );
    }

    /*
     * Create business membership.
     */
    const {
      data: newMember,
      error: memberError,
    } = await supabaseAdmin
      .from("business_members")
      .insert({
        business_id:
          ownerMembership.business_id,
        user_id: employeeUserId,
        role,
        permissions,
        active: true,
      })
      .select(
        "id,business_id,user_id,role,permissions,active,created_at"
      )
      .single();

    if (memberError || !newMember) {
      await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", employeeUserId);

      await supabaseAdmin.auth.admin.deleteUser(
        employeeUserId
      );

      return errorResponse(
        memberError?.message ??
          "Failed to create business membership.",
        500
      );
    }

    const member =
      newMember as BusinessMember;

    const profile: Profile = {
      id: employeeUserId,
      full_name: name,
      username,
      email,
    };

    return NextResponse.json(
      {
        success: true,
        message:
          "Employee account created successfully.",
        employee: employeeToResponse(
          member,
          profile
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST /api/team-users error:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unexpected server error.",
      500
    );
  }
}

/* =========================================================
   PATCH
   Update employee status and/or permissions
   ========================================================= */

export async function PATCH(
  request: NextRequest
) {
  try {
    const {
      user,
      response,
    } = await getLoggedInUser(request);

    if (response) {
      return response;
    }

    if (!user) {
      return errorResponse(
        "Authentication required.",
        401
      );
    }

    const ownerMembership =
      await getOwnerMembership(user.id);

    if (!ownerMembership) {
      return errorResponse(
        "Only a business owner can update team accounts.",
        403
      );
    }

    const businessCheck =
      await verifyBusinessIsActive(
        ownerMembership.business_id
      );

    if (businessCheck.error) {
      return errorResponse(
        businessCheck.error,
        403
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Invalid JSON request body.",
        400
      );
    }

    /*
     * The accounts page sends "id".
     */
    const rawEmployeeId =
      typeof body.id === "string"
        ? body.id
        : null;

    if (
      rawEmployeeId === null ||
      !validUuid(rawEmployeeId)
    ) {
      return errorResponse(
        "A valid employee ID is required.",
        400
      );
    }

    const employeeId =
      rawEmployeeId;

    const {
      data: member,
      error: memberError,
    } = await supabaseAdmin
      .from("business_members")
      .select(
        "id,business_id,user_id,role,permissions,active,created_at"
      )
      .eq("id", employeeId)
      .eq(
        "business_id",
        ownerMembership.business_id
      )
      .maybeSingle();

    if (memberError) {
      return errorResponse(
        memberError.message,
        500
      );
    }

    if (!member) {
      return errorResponse(
        "Employee account not found.",
        404
      );
    }

    const employeeMember =
      member as BusinessMember;

    if (
      employeeMember.role === "owner" ||
      employeeMember.user_id === user.id
    ) {
      return errorResponse(
        "The business owner account cannot be modified here.",
        403
      );
    }

    const updates: Record<
      string,
      unknown
    > = {};

    if (
      typeof body.active === "boolean"
    ) {
      updates.active = body.active;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "permissions"
      )
    ) {
      updates.permissions =
        cleanPermissions(
          body.permissions
        );
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(
        "No valid changes were provided.",
        400
      );
    }

    const {
      data: updatedMember,
      error: updateError,
    } = await supabaseAdmin
      .from("business_members")
      .update(updates)
      .eq("id", employeeId)
      .eq(
        "business_id",
        ownerMembership.business_id
      )
      .select(
        "id,business_id,user_id,role,permissions,active,created_at"
      )
      .single();

    if (updateError || !updatedMember) {
      return errorResponse(
        updateError?.message ??
          "Failed to update employee account.",
        500
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(
        "id,full_name,username,email"
      )
      .eq(
        "id",
        employeeMember.user_id
      )
      .maybeSingle();

    if (profileError) {
      return errorResponse(
        profileError.message,
        500
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Employee account updated successfully.",
      employee: employeeToResponse(
        updatedMember as BusinessMember,
        (profile as Profile | null) ??
          null
      ),
    });
  } catch (error) {
    console.error(
      "PATCH /api/team-users error:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unexpected server error.",
      500
    );
  }
}

/* =========================================================
   DELETE
   Delete an employee account
   ========================================================= */

export async function DELETE(
  request: NextRequest
) {
  try {
    const {
      user,
      response,
    } = await getLoggedInUser(request);

    if (response) {
      return response;
    }

    if (!user) {
      return errorResponse(
        "Authentication required.",
        401
      );
    }

    const ownerMembership =
      await getOwnerMembership(user.id);

    if (!ownerMembership) {
      return errorResponse(
        "Only a business owner can delete team accounts.",
        403
      );
    }

    const businessCheck =
      await verifyBusinessIsActive(
        ownerMembership.business_id
      );

    if (businessCheck.error) {
      return errorResponse(
        businessCheck.error,
        403
      );
    }

    const rawEmployeeId =
      request.nextUrl.searchParams.get(
        "id"
      );

    if (
      rawEmployeeId === null ||
      !validUuid(rawEmployeeId)
    ) {
      return errorResponse(
        "A valid employee ID is required.",
        400
      );
    }

    const employeeId =
      rawEmployeeId;

    const {
      data: member,
      error: memberError,
    } = await supabaseAdmin
      .from("business_members")
      .select(
        "id,business_id,user_id,role,permissions,active,created_at"
      )
      .eq("id", employeeId)
      .eq(
        "business_id",
        ownerMembership.business_id
      )
      .maybeSingle();

    if (memberError) {
      return errorResponse(
        memberError.message,
        500
      );
    }

    if (!member) {
      return errorResponse(
        "Employee account not found.",
        404
      );
    }

    const employeeMember =
      member as BusinessMember;

    if (
      employeeMember.role === "owner" ||
      employeeMember.user_id === user.id
    ) {
      return errorResponse(
        "The business owner account cannot be deleted here.",
        403
      );
    }

    const employeeUserId =
      employeeMember.user_id;

    const {
      error: deleteMemberError,
    } = await supabaseAdmin
      .from("business_members")
      .delete()
      .eq("id", employeeId)
      .eq(
        "business_id",
        ownerMembership.business_id
      );

    if (deleteMemberError) {
      return errorResponse(
        deleteMemberError.message,
        500
      );
    }

    const {
      error: deleteProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", employeeUserId);

    if (deleteProfileError) {
      console.error(
        "Failed to delete employee profile:",
        deleteProfileError
      );
    }

    const {
      error: deleteAuthError,
    } =
      await supabaseAdmin.auth.admin.deleteUser(
        employeeUserId
      );

    if (deleteAuthError) {
      console.error(
        "Failed to delete employee auth user:",
        deleteAuthError
      );

      return NextResponse.json({
        success: true,
        warning:
          "Employee membership was deleted, but the authentication account could not be fully removed.",
      });
    }

    return NextResponse.json({
      success: true,
      message:
        "Employee account deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE /api/team-users error:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unexpected server error.",
      500
    );
  }
}