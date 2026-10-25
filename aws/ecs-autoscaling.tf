# ==============================================================================
# AWS ECS Fargate Auto-Scaling Configuration for LiveKit Voice Agent
# Dynamically scales the agent worker service between 5 and 20 tasks
# ==============================================================================

# 1. Define the Auto-Scaling Target (5 to 20 Tasks)
resource "aws_appautoscaling_target" "agent_target" {
  max_capacity       = 20
  min_capacity       = 5
  resource_id        = "service/${var.ecs_cluster_name}/${var.ecs_service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# 2. Target Tracking Scaling Policy (CPU Utilization)
# When audio DSP / concurrent calls push CPU > 65%, ECS automatically adds tasks
resource "aws_appautoscaling_policy" "agent_cpu_policy" {
  name               = "clinic-agent-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.agent_target.resource_id
  scalable_dimension = aws_appautoscaling_target.agent_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.agent_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 65.0
    scale_in_cooldown  = 300 # 5 min cooldown to allow active patient phone calls to finish gracefully
    scale_out_cooldown = 30  # Scale out in 30 seconds during sudden call spikes

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# 3. Target Tracking Scaling Policy (Memory Utilization)
resource "aws_appautoscaling_policy" "agent_memory_policy" {
  name               = "clinic-agent-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.agent_target.resource_id
  scalable_dimension = aws_appautoscaling_target.agent_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.agent_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 75.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 30

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}
