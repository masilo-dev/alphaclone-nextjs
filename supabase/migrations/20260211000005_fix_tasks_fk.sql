/*
* Fix Tasks Foreign Key
* 
* The related_to_contact field on tasks table was incorrectly referencing profiles (users)
* instead of contacts (CRM contacts).
*/

-- Drop the incorrect constraint
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_related_to_contact_fkey;

-- Add the correct constraint
ALTER TABLE tasks
ADD CONSTRAINT tasks_related_to_contact_fkey
FOREIGN KEY (related_to_contact)
REFERENCES contacts(id)
ON DELETE SET NULL;
