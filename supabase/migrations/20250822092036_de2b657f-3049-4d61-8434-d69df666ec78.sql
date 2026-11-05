-- Add foreign key relationships to improve query performance and data integrity

-- Add foreign key from attendance to profiles
ALTER TABLE attendance 
ADD CONSTRAINT fk_attendance_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key from leave_applications to profiles  
ALTER TABLE leave_applications
ADD CONSTRAINT fk_leave_applications_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key from leave_balance to profiles
ALTER TABLE leave_balance
ADD CONSTRAINT fk_leave_balance_user_id  
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key from regularization_requests to profiles
ALTER TABLE regularization_requests
ADD CONSTRAINT fk_regularization_requests_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key from leave_applications to leave_types
ALTER TABLE leave_applications
ADD CONSTRAINT fk_leave_applications_leave_type_id
FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT;

-- Add foreign key from leave_balance to leave_types  
ALTER TABLE leave_balance
ADD CONSTRAINT fk_leave_balance_leave_type_id
FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT;