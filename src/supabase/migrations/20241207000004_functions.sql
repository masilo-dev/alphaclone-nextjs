-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'client',
    NEW.raw_user_meta_data->>'avatar'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to create notification for contact form submission
CREATE OR REPLACE FUNCTION public.notify_admins_on_contact()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Create notification for all admin users
  FOR admin_record IN
    SELECT id FROM public.profiles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      admin_record.id,
      'contact',
      'New Contact Form Submission',
      'New message from ' || NEW.name || ' (' || NEW.email || ')'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify admins on contact submission
DROP TRIGGER IF EXISTS on_contact_submission ON public.contact_submissions;
CREATE TRIGGER on_contact_submission
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_contact();

-- Function to create notification for new project
CREATE OR REPLACE FUNCTION public.notify_on_new_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    NEW.owner_id,
    'project',
    'New Project Created',
    'Your project "' || NEW.name || '" has been created'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify user on new project
DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_project();

-- Function to create notification for project status change
CREATE OR REPLACE FUNCTION public.notify_on_project_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status OR OLD.current_stage != NEW.current_stage THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.owner_id,
      'project',
      'Project Update',
      'Your project "' || NEW.name || '" status changed to ' || NEW.status || ' - ' || NEW.current_stage
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify user on project update
DROP TRIGGER IF EXISTS on_project_updated ON public.projects;
CREATE TRIGGER on_project_updated
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_project_update();
