import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { studentsApi, classesApi } from '@/lib/api';
import { toast } from 'sonner';

export function ApproveStudentDialog({ 
  student, 
  open, 
  onClose, 
  onSuccess 
}: {
  student: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [classId, setClassId] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [hasExistingClass, setHasExistingClass] = useState(false);

  useEffect(() => {
    if (open && student) {
      loadClasses();
      // Check if student already has a class
      if (student.class_id || student.classId) {
        const existingClassId = student.class_id || student.classId;
        setClassId(existingClassId);
        setHasExistingClass(true);
      } else {
        setClassId('');
        setHasExistingClass(false);
      }
      setRollNo(student.roll_no || student.rollNo || '');
    }
  }, [open, student]);

  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      const data = await classesApi.getAll();
      setClasses(data);
    } catch (error) {
      toast.error('Failed to load classes');
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleApprove = async () => {
    // Only require class selection if student doesn't have one
    if (!hasExistingClass && !classId) {
      toast.error('Please select a class');
      return;
    }

    setLoading(true);
    try {
      const result = await studentsApi.approve(student.id, { 
        classId: classId || student.class_id || student.classId, // Use existing if no new selection
        rollNo: rollNo || undefined 
      });
      toast.success(result.message || 'Student approved and enrolled');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to approve student');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Approve & Assign Class</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label>Student</Label>
              <div className="mt-1 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">{student.name}</p>
                {student.parentPhone && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Phone: {student.parentPhone}
                  </p>
                )}
              </div>
            </div>

            {/* Only show class selector if student doesn't have a class */}
            {!hasExistingClass ? (
              <div>
                <Label>Assign to Class *</Label>
                <Select 
                  value={classId} 
                  onValueChange={setClassId}
                  disabled={loadingClasses}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingClasses ? "Loading classes..." : "Select class"} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}{cls.section ? ` - ${cls.section}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Class (Already Assigned)</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">
                    {(() => {
                      const assignedClass = classes.find(c => c.id === (student.class_id || student.classId));
                      return assignedClass 
                        ? `${assignedClass.name}${assignedClass.section ? ` - ${assignedClass.section}` : ''}`
                        : 'Class assigned';
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Class was assigned during registration
                  </p>
                </div>
                {/* Allow changing class if needed */}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setHasExistingClass(false);
                    setClassId('');
                  }}
                >
                  Change Class
                </Button>
              </div>
            )}

            <div>
              <Label>Roll Number (Optional)</Label>
              <Input
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="Auto-assign if empty"
                type="number"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to auto-assign or set manually
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={loading || (!hasExistingClass && !classId)} 
              className="flex-1"
            >
              {loading ? 'Approving...' : 'Approve & Enroll'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}







