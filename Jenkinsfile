  pipeline {                                                
      agent any

      tools {
            nodejs 'NodeJS 20'
      }

      stages {
          stage('Checkout') {
              steps {
                  checkout scm
              }
          }
          stage('Install') {                                                                                                     
              steps {
                  sh 'npm ci'                                                                                                    
              }                                             
          }
          stage('Build Docker Image') {
              steps {
                  sh 'docker build -t roadmap:${BUILD_NUMBER} .'
              }
          }
      }
  }