# AllPulse Backend API

Node.js/Express backend for the AllPulse School Management System.

## Prerequisites

- Node.js 18+ 
- MySQL 8.0+ (AWS RDS or local)
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=3000
JWT_SECRET=your-super-secret-key-change-in-production
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your-password
DB_NAME=allpulse
```

### 3. Setup Database

Connect to your MySQL database and run the schema:

```bash
mysql -h your-rds-endpoint.amazonaws.com -u admin -p < sql/schema.sql
```

Or run it directly in MySQL:
```sql
source /path/to/backend/sql/schema.sql;
```

### 4. Start the Server

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/superadmin/login` | Super admin login |
| POST | `/api/auth/admin/login` | School admin login |
| POST | `/api/auth/teacher/login` | Teacher login |
| GET | `/api/auth/verify` | Verify JWT token |

### Schools (Super Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schools` | Get all schools |
| GET | `/api/schools/:id` | Get school by ID |
| POST | `/api/schools` | Create new school |
| PUT | `/api/schools/:id` | Update school |
| POST | `/api/schools/:id/deactivate` | Deactivate school |
| GET | `/api/schools/:id/admins` | Get school admins |

### School Admins (Super Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/school-admins` | Create school admin |

### Teachers (School Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teachers` | Get all teachers |
| GET | `/api/teachers/:id` | Get teacher by ID |
| POST | `/api/teachers` | Create teacher |
| PUT | `/api/teachers/:id` | Update teacher |
| POST | `/api/teachers/:id/deactivate` | Deactivate teacher |

### Classes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classes` | Get all classes |
| POST | `/api/classes` | Create class |
| GET | `/api/classes/:id/students` | Get students in class |

### Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students` | Get all students |
| GET | `/api/students/pending` | Get pending registrations |
| POST | `/api/students` | Register student |
| POST | `/api/students/:id/approve` | Approve registration |
| POST | `/api/students/:id/reject` | Reject registration |

### Homework
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/homework` | Get all homework |
| GET | `/api/homework/class/:classId` | Get class homework |
| POST | `/api/homework` | Create homework |
| POST | `/api/homework/:id/complete` | Mark as completed |

## Default Credentials

After running the schema, use these credentials:

**Super Admin:**
- Email: `superadmin@allpulse.com`
- Password: `SuperAdmin@123`

## Deployment on EC2

### 1. SSH into EC2
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 2. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Clone and Setup
```bash
cd /var/www
git clone your-repo-url allpulse-backend
cd allpulse-backend/backend
npm install
cp .env.example .env
nano .env  # Edit with your values
```

### 4. Start with PM2
```bash
sudo npm install -g pm2
pm2 start server.js --name allpulse-api
pm2 startup
pm2 save
```

### 5. Configure Nginx
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Notes

- Change `JWT_SECRET` in production!
- Use strong RDS password
- Enable AWS security groups
- Use HTTPS in production
