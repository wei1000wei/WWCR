// Permission middleware for role-based and permission-based access control

// Role hierarchy: owner > admin > moderator > user
const roleHierarchy = {
  owner: 4,
  admin: 3,
  moderator: 2,
  user: 1
};

// Default permissions for each role
const defaultPermissions = {
  owner: ['*'], // All permissions
  admin: ['manage_users', 'manage_groups', 'view_logs', 'manage_announcements', 'manage_blacklist'],
  moderator: ['kick_users', 'ban_users', 'manage_messages', 'view_logs'],
  user: ['send_messages', 'join_groups', 'upload_files']
};

// Check if user has a specific role or higher
const checkRole = (requiredRole) => {
  return (req, res, next) => {
    const user = req.user;
    const userRoleLevel = roleHierarchy[user.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];
    
    if (userRoleLevel >= requiredRoleLevel) {
      return next();
    }
    
    return res.status(403).json({ msg: `需要 ${requiredRole} 或更高权限` });
  };
};

// Check if user has a specific permission
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    const user = req.user;
    
    // Check if user has the permission directly
    if (user.permissions && user.permissions.includes(requiredPermission)) {
      return next();
    }
    
    // Check if user's role has the permission by default
    const userRole = user.role;
    if (defaultPermissions[userRole] && (defaultPermissions[userRole].includes(requiredPermission) || defaultPermissions[userRole].includes('*'))) {
      return next();
    }
    
    return res.status(403).json({ msg: `需要 ${requiredPermission} 权限` });
  };
};

// Check if user is owner
const checkOwner = (req, res, next) => {
  if (req.user.role === 'owner') {
    return next();
  }
  return res.status(403).json({ msg: '需要 owner 权限' });
};

// Check if user has log access permission
const checkLogAccess = (req, res, next) => {
  const user = req.user;
  
  // Check if user has view_logs permission
  if (user.permissions && user.permissions.includes('view_logs')) {
    return next();
  }
  
  // Check if user's role has view_logs permission by default
  const userRole = user.role;
  if (defaultPermissions[userRole] && (defaultPermissions[userRole].includes('view_logs') || defaultPermissions[userRole].includes('*'))) {
    return next();
  }
  
  return res.status(403).json({ msg: '没有权限访问日志' });
};

module.exports = {
  checkRole,
  checkPermission,
  checkOwner,
  checkLogAccess,
  roleHierarchy,
  defaultPermissions
};
