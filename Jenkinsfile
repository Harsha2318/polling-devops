pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Validate Kubernetes Manifests') {
      steps {
        sh 'kubectl kustomize k8s > rendered-k8s.yml'
      }
    }

    stage('Validate Terraform') {
      steps {
        dir('terraform') {
          sh 'terraform fmt -check -recursive'
          sh 'terraform init -backend=false'
          sh 'terraform validate'
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts allowEmptyArchive: true, artifacts: 'rendered-k8s.yml'
    }
    success {
      echo 'GitOps and infrastructure validation completed successfully.'
    }
    failure {
      echo 'GitOps or infrastructure validation failed.'
    }
  }
}
